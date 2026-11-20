class_name Graf
extends RefCounted
## Silniční graf převzatý z předlohy (World._initGraph): uzly na křižovatkách a koncích silnic,
## orientované hrany po bodech silnic (jednosměrky jen jedním směrem). Slouží k navigaci,
## délce tras zakázek a k dopravě. Hledání cesty je A* jako findPath v src/world/world.js
## (zatím bez zákazů odbočení).

const DRIVABLE_MAX := 13
const RF_ONEWAY := 1
const RF_BRIDGE := 2
const RF_TUNNEL := 4
const RF_ROUNDABOUT := 8
const RF_PRIVATE := 32
const BUNKA := 64.0

static var _instance: Graf

var uzel_x: PackedFloat32Array
var uzel_z: PackedFloat32Array
var h_od: PackedInt32Array
var h_do: PackedInt32Array
var h_a: PackedInt32Array
var h_b: PackedInt32Array
var h_delka: PackedFloat32Array
var h_silnice: PackedInt32Array
var vystup_zac: PackedInt32Array
var vystup_hrany: PackedInt32Array
var bod_x: PackedFloat32Array
var bod_z: PackedFloat32Array
var bod_y: PackedFloat32Array
var silnice_zac: PackedInt32Array
var trida: PackedByteArray
var priznaky: PackedByteArray
var sirka: PackedFloat32Array
var pruhy: PackedByteArray
var nazev: PackedInt32Array
var rychlost_vpred: PackedByteArray
var rychlost_vzad: PackedByteArray
var _mrizka := {}       ## buňka 64 m -> hrany, které jí procházejí


static func nacti() -> Graf:
	if _instance:
		return _instance
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + "graf.bin")
	if surova.is_empty():
		push_error("Chybí silniční graf data/svet/graf.bin")
		return null
	var d: Dictionary = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
	var g := Graf.new()
	g.uzel_x = d.uzelX
	g.uzel_z = d.uzelZ
	g.h_od = d.hOd
	g.h_do = d.hDo
	g.h_a = d.hA
	g.h_b = d.hB
	g.h_delka = d.hDelka
	g.h_silnice = d.hSilnice
	g.vystup_zac = d.vystupZac
	g.vystup_hrany = d.vystupHrany
	g.bod_x = d.bodX
	g.bod_z = d.bodZ
	g.bod_y = d.bodY
	g.silnice_zac = d.silniceZac
	g.trida = d.trida
	g.priznaky = d.priznaky
	g.sirka = d.sirka
	g.pruhy = d.pruhy
	g.nazev = d.nazev
	g.rychlost_vpred = d.rychlostVpred
	g.rychlost_vzad = d.rychlostVzad
	g._mrizku()
	_instance = g
	return g


func pocet_uzlu() -> int:
	return uzel_x.size()


func pocet_hran() -> int:
	return h_od.size()


func _mrizku() -> void:
	for e in h_od.size():
		if h_a[e] > h_b[e]:
			continue
		for k in range(h_a[e], h_b[e] + 1):
			var b := Vector2i(floori(bod_x[k] / BUNKA), floori(bod_z[k] / BUNKA))
			if not _mrizka.has(b):
				_mrizka[b] = PackedInt32Array()
			var seznam: PackedInt32Array = _mrizka[b]
			if seznam.is_empty() or seznam[seznam.size() - 1] != e:
				seznam.append(e)
				_mrizka[b] = seznam


## Nejbližší bod sjízdné hrany: {hrana, vzdalenost, x, z, podel (m od začátku hrany)} nebo {}.
func nejblizsi_hrana(x: float, z: float, max_vzdalenost := 60.0, jen_verejne := true) -> Dictionary:
	var nej := {}
	var nej_d := max_vzdalenost * max_vzdalenost
	var r := ceili(max_vzdalenost / BUNKA)
	var c := Vector2i(floori(x / BUNKA), floori(z / BUNKA))
	for dz in range(-r, r + 1):
		for dx in range(-r, r + 1):
			for e: int in _mrizka.get(c + Vector2i(dx, dz), PackedInt32Array()):
				var silnice := h_silnice[e]
				if jen_verejne and priznaky[silnice] & RF_PRIVATE:
					continue
				var podel := 0.0
				for k in range(h_a[e], h_b[e]):
					var ax := bod_x[k]
					var az := bod_z[k]
					var sx := bod_x[k + 1] - ax
					var sz := bod_z[k + 1] - az
					var l2 := sx * sx + sz * sz
					var t := 0.0 if l2 <= 0.0 else clampf(((x - ax) * sx + (z - az) * sz) / l2, 0.0, 1.0)
					var px := ax + sx * t
					var pz := az + sz * t
					var d2 := (px - x) * (px - x) + (pz - z) * (pz - z)
					if d2 < nej_d:
						nej_d = d2
						nej = {"hrana": e, "vzdalenost": sqrt(d2), "x": px, "z": pz, "podel": podel + sqrt(l2) * t}
					podel += sqrt(l2)
	return nej


## Nejbližší uzel grafu k bodu (přes nejbližší silnici), nebo −1.
func nejblizsi_uzel(x: float, z: float, max_vzdalenost := 250.0) -> int:
	var h := nejblizsi_hrana(x, z, minf(max_vzdalenost, 120.0))
	if h.is_empty():
		var nej := -1
		var nej_d := max_vzdalenost * max_vzdalenost
		for n in uzel_x.size():
			var d := (uzel_x[n] - x) * (uzel_x[n] - x) + (uzel_z[n] - z) * (uzel_z[n] - z)
			if d < nej_d:
				nej_d = d
				nej = n
		return nej
	var e: int = h.hrana
	return h_od[e] if h.podel < h_delka[e] * 0.5 else h_do[e]


## Cesta z uzlu a do uzlu b jako seznam hran, nebo null. Heuristika = vzdušná vzdálenost.
func najdi_cestu(a: int, b: int, max_rozbaleni := 9000) -> Variant:
	if a < 0 or b < 0:
		return null
	if a == b:
		return PackedInt32Array()
	var bx := uzel_x[b]
	var bz := uzel_z[b]
	var skore := {a: 0.0}
	var predchozi := {}
	var halda := Halda.new()
	halda.vloz(Vector2(uzel_x[a] - bx, uzel_z[a] - bz).length(), a)
	var uzavrene := {}
	var rozbaleno := 0
	while not halda.prazdna():
		var n := halda.vyjmi()
		if uzavrene.has(n):
			continue
		if n == b:
			var cesta := PackedInt32Array()
			var at := b
			while predchozi.has(at):
				var e: int = predchozi[at]
				cesta.append(e)
				at = h_od[e]
			cesta.reverse()
			return cesta
		uzavrene[n] = true
		rozbaleno += 1
		if rozbaleno > max_rozbaleni:
			return null
		var g: float = skore[n]
		for q in range(vystup_zac[n], vystup_zac[n + 1]):
			var e := vystup_hrany[q]
			if priznaky[h_silnice[e]] & RF_PRIVATE:
				continue
			var m := h_do[e]
			var ng := g + h_delka[e]
			if ng < skore.get(m, INF):
				skore[m] = ng
				predchozi[m] = e
				halda.vloz(ng + Vector2(uzel_x[m] - bx, uzel_z[m] - bz).length(), m)
	return null


## Délka trasy po silnicích mezi dvěma body (s náhradou 1,5 × vzdušná, když trasa nejde najít).
func delka_trasy(ax: float, az: float, bx: float, bz: float) -> float:
	var cesta: Variant = najdi_cestu(nejblizsi_uzel(ax, az), nejblizsi_uzel(bx, bz))
	var vzdusna := Vector2(bx - ax, bz - az).length()
	if cesta == null:
		return vzdusna * 1.5
	var d := 0.0
	for e: int in cesta:
		d += h_delka[e]
	return maxf(d, vzdusna)


## Body trasy (x, z) pro navigaci po seznamu hran.
func body_cesty(cesta: PackedInt32Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for e in cesta:
		var A := h_a[e]
		var B := h_b[e]
		var krok := 1 if A < B else -1
		var k := A
		while true:
			out.append(Vector2(bod_x[k], bod_z[k]))
			if k == B:
				break
			k += krok
	return out


## Bod na hraně ve vzdálenosti d od začátku (ve směru jízdy), s posunem vpravo (edgePoint v předloze).
## Vrací Vector4(x, z, tx, tz).
func bod_na_hrane(e: int, d: float, bok := 0.0) -> Vector4:
	var A := h_a[e]
	var B := h_b[e]
	var krok := 1 if A < B else -1
	var k := A
	var x := bod_x[A]
	var z := bod_z[A]
	var tx := 0.0
	var tz := 1.0
	while k != B:
		var nx := bod_x[k + krok]
		var nz := bod_z[k + krok]
		var l := Vector2(nx - bod_x[k], nz - bod_z[k]).length()
		if l > 1e-6:
			tx = (nx - bod_x[k]) / l
			tz = (nz - bod_z[k]) / l
		if d <= l or k + krok == B:
			var t := minf(d, l) / l if l > 0.0 else 0.0
			x = bod_x[k] + (nx - bod_x[k]) * t
			z = bod_z[k] + (nz - bod_z[k]) * t
			break
		d -= l
		k += krok
	return Vector4(x - tz * bok, z + tx * bok, tx, tz)


func rychlost_silnice(silnice: int, vpred: bool) -> int:
	return rychlost_vpred[silnice] if vpred else rychlost_vzad[silnice]


## Binární halda (minimum) pro A*.
class Halda:
	var f := PackedFloat32Array()
	var n := PackedInt32Array()

	func prazdna() -> bool:
		return n.is_empty()

	func vloz(hodnota: float, uzel: int) -> void:
		f.append(hodnota)
		n.append(uzel)
		var i := n.size() - 1
		while i > 0:
			var p := (i - 1) >> 1
			if f[p] <= hodnota:
				break
			f[i] = f[p]
			n[i] = n[p]
			i = p
		f[i] = hodnota
		n[i] = uzel

	func vyjmi() -> int:
		var vysledek := n[0]
		var posledni := n.size() - 1
		var lf := f[posledni]
		var ln := n[posledni]
		f.resize(posledni)
		n.resize(posledni)
		if posledni == 0:
			return vysledek
		var i := 0
		while true:
			var l := i * 2 + 1
			if l >= posledni:
				break
			var r := l + 1
			var m := l if r >= posledni or f[l] <= f[r] else r
			if f[m] >= lf:
				break
			f[i] = f[m]
			n[i] = n[m]
			i = m
		f[i] = lf
		n[i] = ln
		return vysledek
