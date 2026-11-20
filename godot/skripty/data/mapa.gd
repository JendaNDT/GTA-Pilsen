@tool
class_name Mapa
extends RefCounted
## Data mapy Plzně převedená z původní hry nástrojem tools/godot/export_svet.mjs.
##
## Soubory jsou ve složce res://data/svet/. Každý soubor .pak obsahuje jednu vrstvu
## (terén, povrch, silnice, budovy, stromy, lampy) rozdělenou na dlaždice 256 × 256 m.
## Herní souřadnice: x na východ, z na jih, y nahoru, metry. Počátek je na náměstí Republiky.

const SLOZKA := "res://data/svet/"

static var nacteno := false
static var info: Dictionary = {}
static var dlazdice := 256.0
static var sloupce := 0
static var radky := 0
static var min_x := 0.0
static var min_z := 0.0
static var hranice := Rect2()          ## hratelné území (x, z)
static var paleta := PackedColorArray()
static var nazvy_ulic: Array = []
static var pocatek: Dictionary = {}    ## lat, lon, kx, ky pro převod GPS

static var _paky := {}
static var _zamek := Mutex.new()
static var _teren := {}


## Načte popis mapy. Volá se automaticky při prvním použití.
static func nacti() -> bool:
	if nacteno:
		return true
	var text := FileAccess.get_file_as_string(SLOZKA + "svet.json")
	if text.is_empty():
		push_error("Chybí data mapy %ssvet.json. Spusťte převod: node tools/godot/export_svet.mjs" % SLOZKA)
		return false
	info = JSON.parse_string(text)
	dlazdice = info.dlazdice
	sloupce = info.sloupce
	radky = info.radky
	min_x = info.minX
	min_z = info.minZ
	pocatek = info.pocatek
	var h: Dictionary = info.hraniceHry
	hranice = Rect2(h.minX, h.minZ, h.maxX - h.minX, h.maxZ - h.minZ)
	paleta = PackedColorArray()
	for hex: String in info.paleta:
		paleta.append(Color.html(hex))
	var nazvy := FileAccess.get_file_as_string(SLOZKA + "nazvy-ulic.json")
	nazvy_ulic = JSON.parse_string(nazvy) if not nazvy.is_empty() else []
	nacteno = true
	return true


# ------------------------------------------------------------------ dlaždice

static func index_dlazdice(x: float, z: float) -> int:
	var cx := floori((x - min_x) / dlazdice)
	var cz := floori((z - min_z) / dlazdice)
	if cx < 0 or cz < 0 or cx >= sloupce or cz >= radky:
		return -1
	return cz * sloupce + cx


static func roh_dlazdice(ci: int) -> Vector2:
	return Vector2(min_x + (ci % sloupce) * dlazdice, min_z + (ci / sloupce) * dlazdice)


static func _pak(nazev: String) -> Dictionary:
	if _paky.has(nazev):
		return _paky[nazev]
	var f := FileAccess.open(SLOZKA + nazev + ".pak", FileAccess.READ)
	var p := {}
	if f == null:
		push_warning("Chybí vrstva mapy %s.pak" % nazev)
	elif f.get_buffer(4).get_string_from_ascii() != "PLZG":
		push_error("Neznámý formát vrstvy %s.pak" % nazev)
	else:
		f.get_32()
		var pocet := f.get_32()
		f.get_32()
		var posuny := f.get_buffer((pocet + 1) * 4).to_int32_array()
		p = {"f": f, "o": posuny, "zacatek": 16 + (pocet + 1) * 4}
	_paky[nazev] = p
	return p


## Vrátí obsah dlaždice z vrstvy (Dictionary), nebo null, když tam nic není.
static func blok(nazev: String, ci: int) -> Variant:
	if not nacti() or ci < 0:
		return null
	_zamek.lock()
	var p := _pak(nazev)
	if p.is_empty():
		_zamek.unlock()
		return null
	var o: PackedInt32Array = p.o
	var a := o[ci]
	var b := o[ci + 1]
	if b <= a:
		_zamek.unlock()
		return null
	var f: FileAccess = p.f
	f.seek(p.zacatek + a)
	var surovy := f.get_buffer(b - a)
	_zamek.unlock()
	return bytes_to_var(surovy.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))


# ------------------------------------------------------------------ terén

class Teren:
	var ci := 0
	var x0 := 0.0
	var z0 := 0.0
	var g := 8.0           ## krok sítě v metrech (8, 4 nebo 2)
	var n := 33            ## počet bodů na straně
	var h := PackedFloat32Array()
	var indexy := PackedInt32Array()   ## jen u výjimečné dlaždice, jinak prázdné
	var hl := PackedByteArray()        ## hloubka vody pod hladinou v cm, mřížka 65 × 65 po 4 m (jen u vody)


## Výšková síť dlaždice (uchovává se v paměti, je malá).
static func teren(ci: int) -> Teren:
	_zamek.lock()
	var t: Teren = _teren.get(ci)
	_zamek.unlock()
	if t:
		return t
	t = Teren.new()
	t.ci = ci
	var roh := roh_dlazdice(ci)
	t.x0 = roh.x
	t.z0 = roh.y
	var d: Variant = blok("teren", ci)
	if d == null:
		t.n = 2
		t.g = dlazdice
		t.h = PackedFloat32Array([0.0, 0.0, 0.0, 0.0])
	else:
		t.g = d.g
		t.n = d.n
		var rozdily: PackedByteArray = d.d
		var pocet := t.n * t.n
		t.h.resize(pocet)
		var v: int = d.y0
		t.h[0] = v * 0.01
		for k in range(1, pocet):
			v += rozdily.decode_s16(k * 2)
			t.h[k] = v * 0.01
		if d.has("idx"):
			t.indexy = d.idx
		if d.has("hl"):
			t.hl = d.hl
	_zamek.lock()
	_teren[ci] = t
	_zamek.unlock()
	return t


## Výška terénu v bodě (m), shodná s viditelnými trojúhelníky. Mosty a střechy nezahrnuje.
static func vyska(x: float, z: float) -> float:
	if not nacti():
		return 0.0
	var cx := clampi(floori((x - min_x) / dlazdice), 0, sloupce - 1)
	var cz := clampi(floori((z - min_z) / dlazdice), 0, radky - 1)
	var t := teren(cz * sloupce + cx)
	var gx := clampf((x - t.x0) / t.g, 0.0, t.n - 1.001)
	var gz := clampf((z - t.z0) / t.g, 0.0, t.n - 1.001)
	var i := int(gx)
	var j := int(gz)
	var fx := gx - i
	var fz := gz - j
	var k := j * t.n + i
	var h := t.h
	if fx + fz <= 1.0:
		var c := h[k]
		return c + (h[k + 1] - c) * fx + (h[k + t.n] - c) * fz
	var c2 := h[k + t.n + 1]
	return c2 + (h[k + t.n] - c2) * (1.0 - fx) + (h[k + 1] - c2) * (1.0 - fz)


## Hloubka vody pod viditelnou hladinou (m), riverBed v předloze: od břehu klesá o 0,12 m na metr
## (prvních 8 m), dál o 0,025 m na metr, nejvýš 2,4 m. Mimo vodu 0.
static func hloubka(x: float, z: float) -> float:
	if not nacti():
		return 0.0
	var cx := floori((x - min_x) / dlazdice)
	var cz := floori((z - min_z) / dlazdice)
	if cx < 0 or cz < 0 or cx >= sloupce or cz >= radky:
		return 0.0
	var t := teren(cz * sloupce + cx)
	if t.hl.is_empty():
		return 0.0
	var gx := clampf((x - t.x0) / 4.0, 0.0, 63.999)
	var gz := clampf((z - t.z0) / 4.0, 0.0, 63.999)
	var i := int(gx)
	var j := int(gz)
	var fx := gx - i
	var fz := gz - j
	var k := j * 65 + i
	var a := lerpf(t.hl[k], t.hl[k + 1], fx)
	var b := lerpf(t.hl[k + 65], t.hl[k + 66], fx)
	return lerpf(a, b, fz) * 0.01


## Dno pod vodou nebo terén (m).
static func dno(x: float, z: float) -> float:
	return vyska(x, z) - hloubka(x, z)


## Normála terénu z okolních výšek.
static func normala(x: float, z: float, krok := 2.0) -> Vector3:
	var hx := (vyska(x + krok, z) - vyska(x - krok, z)) / (2.0 * krok)
	var hz := (vyska(x, z + krok) - vyska(x, z - krok)) / (2.0 * krok)
	return Vector3(-hx, 1.0, -hz).normalized()


# ------------------------------------------------------------------ převody

## Zeměpisná šířka a délka (WGS 84) na herní metry.
static func gps_na_svet(lat: float, lon: float) -> Vector2:
	nacti()
	return Vector2((lon - pocatek.lon) * pocatek.kx, (pocatek.lat - lat) * pocatek.ky)


static func svet_na_gps(x: float, z: float) -> Vector2:
	nacti()
	return Vector2(pocatek.lat - z / pocatek.ky, pocatek.lon + x / pocatek.kx)


# ------------------------------------------------------------------ ulice

static var _ulice := {}


## Osy silnic v dlaždici: {u: PackedInt32Array (9 čísel na úsek), w: šířky, p: body}.
static func ulice_dlazdice(ci: int) -> Variant:
	if ci < 0:
		return null
	_zamek.lock()
	var hotovo := _ulice.has(ci)
	var u: Variant = _ulice.get(ci)
	_zamek.unlock()
	if hotovo:
		return u
	u = blok("ulice", ci)
	_zamek.lock()
	_ulice[ci] = u
	_zamek.unlock()
	return u


## Nejbližší silnice nebo cesta. Vrací {silnice, nazev, trida, sirka, vzdalenost, bod, smer},
## nebo prázdný slovník. max_trida omezuje druh (13 = jen sjízdné silnice, 99 = vše).
static func nejblizsi_ulice(x: float, z: float, max_vzdalenost := 30.0, max_trida := 99, min_trida := 0) -> Dictionary:
	if not nacti():
		return {}
	var nej := {}
	var nej_d2 := max_vzdalenost * max_vzdalenost
	var c0 := floori((x - max_vzdalenost - min_x) / dlazdice)
	var c1 := floori((x + max_vzdalenost - min_x) / dlazdice)
	var r0 := floori((z - max_vzdalenost - min_z) / dlazdice)
	var r1 := floori((z + max_vzdalenost - min_z) / dlazdice)
	for cz in range(maxi(0, r0), mini(radky - 1, r1) + 1):
		for cx in range(maxi(0, c0), mini(sloupce - 1, c1) + 1):
			var u: Variant = ulice_dlazdice(cz * sloupce + cx)
			if u == null:
				continue
			var U: PackedInt32Array = u.u
			var P: PackedVector3Array = u.p
			for q in range(0, U.size(), 9):
				var trida := U[q + 2]
				if trida > max_trida or trida < min_trida:
					continue
				var zac := U[q + 7]
				var pocet := U[q + 8]
				for k in range(zac, zac + pocet - 1):
					var a := P[k]
					var b := P[k + 1]
					var dx := b.x - a.x
					var dz := b.z - a.z
					var l2 := dx * dx + dz * dz
					var t := 0.0 if l2 <= 0.0 else clampf(((x - a.x) * dx + (z - a.z) * dz) / l2, 0.0, 1.0)
					var px := a.x + dx * t
					var pz := a.z + dz * t
					var d2 := (px - x) * (px - x) + (pz - z) * (pz - z)
					if d2 < nej_d2:
						nej_d2 = d2
						var jmeno := U[q + 1]
						nej = {"silnice": U[q], "nazev": nazvy_ulic[jmeno] if jmeno >= 0 and jmeno < nazvy_ulic.size() else "",
							"trida": trida, "sirka": u.w[q / 9], "priznaky": U[q + 3], "pruhy": U[q + 4],
							"rychlost": U[q + 5], "vzdalenost": sqrt(d2),
							"bod": Vector3(px, a.y + (b.y - a.y) * t, pz), "smer": Vector3(dx, 0, dz).normalized()}
	return nej


# ------------------------------------------------------------------ místa

static var _mista: Dictionary = {}


static func mista() -> Dictionary:
	if _mista.is_empty():
		var text := FileAccess.get_file_as_string(SLOZKA + "mista.json")
		_mista = JSON.parse_string(text) if not text.is_empty() else {"obce": [], "pamatky": []}
	return _mista


## Název čtvrti nebo obce v okolí (districtAt v předloze): menší části mají přednost,
## když jsou blízko; dál než 1,5 km se nevypisuje nic.
static func nejblizsi_obec(x: float, z: float) -> String:
	var nej := ""
	var nej_d := 1500.0 * 1500.0
	for o: Dictionary in mista().obce:
		if o.druh == "city":
			continue
		var w := 1.0 if o.druh == "suburb" else 0.75
		var d: float = ((o.x - x) * (o.x - x) + (o.z - z) * (o.z - z)) * w
		if d < nej_d:
			nej_d = d
			nej = o.nazev
	return nej


## Nadmořská výška bodu ve hře (m n. m.).
static func nadmorska_vyska(y: float) -> int:
	nacti()
	return roundi(float(info.nadmorskaVyska) + y)
