class_name JizdniRad
extends RefCounted
## Jízdní řád PMDP (GTFS) převedený nástrojem export_svet.mjs do data/svet/mhd.bin.
## Výpočty odpovídají src/game/timetable.js: spoj má šablonu zastavení, časy příjezdů a odjezdů
## v sekundách od půlnoci dne vypravení (mohou přesáhnout 24:00) a podle času z nich plyne poloha vozu.

const DEN := 86400
const STANI := 5.0              ## STOP_DWELL: doba otevřených dveří na zastávce (s)
const NAJEZD := 8.0             ## APPROACH_SPEED: rychlost přejezdu z/do vozovny (m/s)
const BUNKA := 128.0

static var _instance: JizdniRad

var start_den := 0
var konec_den := 0
var kalendar: Dictionary
var trasy: Array[Trasa] = []
var stanoviste: Array = []       ## [název, x, z, kód]
var spoje_podle_sluzby: Array = []
var zastaveni_na_stanovisti: Array = []   ## pro každé stanoviště [[služba, spoj, pořadí], …]
var prestupy: Array = []
var max_posun := 0
var _mrizka := {}
var _cache_dnu := {}


## Jedna trasa linky: lomená čára, kumulativní délky, normály pruhu a výškový profil.
class Trasa:
	var typ := ""
	var linka := ""
	var odkud := ""
	var kam := ""
	var body := PackedFloat32Array()     ## x, z
	var kum := PackedFloat64Array()
	var normaly := PackedFloat32Array()
	var vysky := PackedInt32Array()       ## cm po krok metrech
	var krok := 10.0
	var delka := 0.0
	var zastavky: Array = []              ## [vzdálenost s, název]

	func priprav() -> void:
		var n := body.size() / 2
		kum.resize(n)
		kum[0] = 0.0
		for i in range(1, n):
			kum[i] = kum[i - 1] + Vector2(body[i * 2] - body[i * 2 - 2], body[i * 2 + 1] - body[i * 2 - 1]).length()
		delka = kum[n - 1]
		# Posunuté sousední úseky sdílejí vrchol i v zatáčce (laneNormals v předloze).
		normaly.resize(n * 2)
		var nx := 0.0
		var nz := 0.0
		var pred := 0
		for i in range(1, n):
			var l := kum[i] - kum[pred]
			if l == 0.0:
				continue
			var x := -(body[2 * i + 1] - body[2 * pred + 1]) / l
			var z := (body[2 * i] - body[2 * pred]) / l
			if pred == 0:
				nx = x
				nz = z
			var sc := 1.0 / maxf(0.5, 1.0 + nx * x + nz * z)
			for j in range(pred, i):
				normaly[2 * j] = (nx + x) * sc
				normaly[2 * j + 1] = (nz + z) * sc
			pred = i
			nx = x
			nz = z
		for j in range(pred, n):
			normaly[2 * j] = nx
			normaly[2 * j + 1] = nz

	## Poloha ve vzdálenosti s s bočním posunem: Vector4(x, z, tx, tz).
	func poloha(s: float, bok := 0.0) -> Vector4:
		s = clampf(s, 0.0, delka)
		var lo := 0
		var hi := kum.size() - 1
		while hi - lo > 1:
			var m := (lo + hi) >> 1
			if kum[m] <= s:
				lo = m
			else:
				hi = m
		var x := body[lo * 2]
		var z := body[lo * 2 + 1]
		var dx := body[hi * 2] - x
		var dz := body[hi * 2 + 1] - z
		var l := kum[hi] - kum[lo]
		if l == 0.0:
			l = 1.0
		var t := (s - kum[lo]) / l
		return Vector4(x + dx * t + bok * (normaly[lo * 2] + t * (normaly[hi * 2] - normaly[lo * 2])),
			z + dz * t + bok * (normaly[lo * 2 + 1] + t * (normaly[hi * 2 + 1] - normaly[lo * 2 + 1])),
			dx / l, dz / l)

	## Výška povrchu na trase ve vzdálenosti s.
	func vyska(s: float) -> float:
		var f := clampf(s, 0.0, delka) / krok
		var i := mini(int(f), vysky.size() - 2)
		var t := f - i
		return (vysky[i] + (vysky[i + 1] - vysky[i]) * t) * 0.01


static func nacti() -> JizdniRad:
	if _instance:
		return _instance
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + "mhd.bin")
	if surova.is_empty():
		push_error("Chybí jízdní řád data/svet/mhd.bin")
		return null
	var d: Dictionary = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
	var j := JizdniRad.new()
	j._z_dat(d)
	_instance = j
	return j


static func den_z_textu(text: String) -> int:
	var p := text.split("-")
	return Slunce.den_z_data(int(p[0]), int(p[1]), int(p[2]))


static func den_v_tydnu(den: int) -> int:
	return ((den + 3) % 7 + 7) % 7


static func cas(hodnota: int) -> int:
	return hodnota if hodnota >= 0 else -hodnota - 1


func _z_dat(d: Dictionary) -> void:
	kalendar = d.kalendar
	start_den = den_z_textu(kalendar.start)
	konec_den = den_z_textu(kalendar.end)
	for t: Dictionary in d.trasy:
		var r := Trasa.new()
		r.typ = t.typ
		r.linka = t.linka
		r.odkud = t.odkud
		r.kam = t.kam
		r.body = t.body
		r.vysky = t.vysky
		r.krok = d.krok
		r.zastavky = t.zastavky
		r.priprav()
		trasy.append(r)
	stanoviste = d.stanoviste
	zastaveni_na_stanovisti.resize(stanoviste.size())
	prestupy.resize(stanoviste.size())
	for i in stanoviste.size():
		zastaveni_na_stanovisti[i] = []
		prestupy[i] = []
		var klic := _klic(stanoviste[i][1], stanoviste[i][2])
		if not _mrizka.has(klic):
			_mrizka[klic] = []
		_mrizka[klic].append(i)
	for p: PackedInt32Array in d.prestupy:
		prestupy[p[0]].append({"kam": p[1], "minimum": p[2]})
	var vzory := []
	for v: Array in d.vzory:
		var trasa: Trasa = trasy[v[0]] if v[0] < trasy.size() else null
		var ss: PackedInt32Array = v[1]
		var zastaveni := []
		var ok := trasa != null and ss.size() >= 4
		for k in range(0, ss.size(), 2):
			if not ok or ss[k + 1] >= trasa.zastavky.size():
				ok = false
				break
			zastaveni.append({"stanoviste": ss[k], "cil": trasa.zastavky[ss[k + 1]]})
		vzory.append({"trasa": trasa, "zastaveni": zastaveni, "smer_cil": v[2], "vjezd": v[4], "vyjezd": v[5]} if ok else null)
	for s: Array in d.spoje:
		var p: Variant = vzory[s[2]]
		if p == null:
			continue
		var casy: PackedInt32Array = s[3]
		var start_s: float = p.zastaveni[0].cil[0]
		var posledni_s: float = p.zastaveni[-1].cil[0]
		var konec_s: float = p.trasa.delka if p.vyjezd else posledni_s
		var prvni_odjezd := cas(casy[1])
		var posledni_prijezd := cas(casy[casy.size() - 2])
		var spoj := {"id": s[0], "trasa": p.trasa, "zastaveni": p.zastaveni, "cil": p.smer_cil, "vjezd": p.vjezd,
			"vyjezd": p.vyjezd, "casy": casy, "start_s": start_s, "posledni_s": posledni_s, "konec_s": konec_s,
			"zacatek": prvni_odjezd - int(STANI) - (roundi(start_s / NAJEZD) if p.vjezd else 0),
			"konec": posledni_prijezd + int(STANI) + roundi((konec_s - posledni_s) / NAJEZD)}
		max_posun = maxi(max_posun, int(floor(float(spoj.konec) / DEN)))
		var sluzba: int = s[1]
		while spoje_podle_sluzby.size() <= sluzba:
			spoje_podle_sluzby.append([])
		spoje_podle_sluzby[sluzba].append(spoj)
		for i in range(0, p.zastaveni.size() - 1):
			if casy[i * 2 + 1] >= 0:
				zastaveni_na_stanovisti[p.zastaveni[i].stanoviste].append([sluzba, spoj, i])


func _klic(x: float, z: float) -> Vector2i:
	return Vector2i(floori(x / BUNKA), floori(z / BUNKA))


## Služby (provozní dny) platné v daný den.
func profil(den: int) -> Array:
	var profily: Array = kalendar.profiles
	if den >= start_den and den <= konec_den:
		return profily[kalendar.days[den - start_den]]
	return profily[kalendar.weekly[den_v_tydnu(den)]]


## Spoje, které jedou v daný den (včetně spojů z předchozích dnů po půlnoci).
func udalosti(den: int) -> Array:
	if _cache_dnu.has(den):
		return _cache_dnu[den]
	var out := []
	for vypraveni in range(den - max_posun, den + 2):
		var pulnoc := vypraveni * DEN
		for sluzba: int in profil(vypraveni):
			if sluzba >= spoje_podle_sluzby.size():
				continue
			for spoj: Dictionary in spoje_podle_sluzby[sluzba]:
				var a: int = pulnoc + spoj.zacatek
				var b: int = pulnoc + spoj.konec
				if a < (den + 1) * DEN and b > den * DEN:
					out.append({"klic": "%d:%s" % [vypraveni, spoj.id], "den": vypraveni, "zacatek": a, "konec": b, "spoj": spoj})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.zacatek < b.zacatek)
	_cache_dnu[den] = out
	if _cache_dnu.size() > 3:
		_cache_dnu.erase(_cache_dnu.keys()[0])
	return out


## Plánovaný stav spoje v čase ted: {s, index (příští zastávka), cekani (s otevřených dveří)}.
func stav(udalost: Dictionary, ted: float) -> Dictionary:
	var spoj: Dictionary = udalost.spoj
	var zastaveni: Array = spoj.zastaveni
	var casy: PackedInt32Array = spoj.casy
	var uplynulo: float = ted - float(udalost.den) * DEN
	var prvni_odjezd := cas(casy[1])
	if uplynulo < prvni_odjezd:
		var otevreni := prvni_odjezd - STANI
		if spoj.vjezd and uplynulo < otevreni:
			var podil := maxf(0.0, (ted - udalost.zacatek) / maxf(1.0, otevreni - spoj.zacatek))
			return {"s": spoj.start_s * minf(1.0, podil), "index": 0, "cekani": 0.0}
		return {"s": spoj.start_s, "index": 0, "cekani": prvni_odjezd - uplynulo}
	var predchozi_uvolneni := float(prvni_odjezd)
	for i in range(1, zastaveni.size()):
		var prijezd := float(cas(casy[i * 2]))
		var odjezd := float(cas(casy[i * 2 + 1]))
		var s: float = zastaveni[i].cil[0]
		var konecna := i == zastaveni.size() - 1
		var k_dalsi := 0.0 if konecna else float(cas(casy[(i + 1) * 2])) - prijezd
		var uvolneni := prijezd + STANI if konecna else maxf(prijezd + maxf(1.0, minf(STANI, k_dalsi * 0.45)), odjezd)
		if uplynulo >= uvolneni:
			predchozi_uvolneni = uvolneni
			continue
		if uplynulo >= prijezd:
			return {"s": s, "index": i, "cekani": uvolneni - uplynulo}
		var a: float = zastaveni[i - 1].cil[0]
		var postup := maxf(0.0, (uplynulo - predchozi_uvolneni) / maxf(1.0, prijezd - predchozi_uvolneni))
		return {"s": a + (s - a) * postup, "index": i, "cekani": 0.0}
	var vyjezd: float = (spoj.konec_s - spoj.posledni_s) / NAJEZD
	var postup := clampf((uplynulo - (spoj.konec - vyjezd)) / maxf(1.0, vyjezd), 0.0, 1.0)
	return {"s": spoj.posledni_s + (spoj.konec_s - spoj.posledni_s) * postup, "index": zastaveni.size(), "cekani": 0.0}


## Nejbližší stanoviště do poloměru (index), nebo −1.
func nejblizsi(x: float, z: float, polomer := 55.0) -> int:
	var nej := -1
	var nej_d := polomer * polomer
	for a in range(floori((x - polomer) / BUNKA), floori((x + polomer) / BUNKA) + 1):
		for b in range(floori((z - polomer) / BUNKA), floori((z + polomer) / BUNKA) + 1):
			for i: int in _mrizka.get(Vector2i(a, b), []):
				var d: float = (x - stanoviste[i][1]) ** 2 + (z - stanoviste[i][2]) ** 2
				if d < nej_d:
					nej_d = d
					nej = i
	return nej


## Nejbližší odjezdy ze stanoviště: {stanoviste, kod, radky: [{cas, linka, typ, cil}]}.
func odjezdy(stanice: int, ted: float, horizont := 5400.0, pocet := 3) -> Dictionary:
	var kraj := ted + horizont
	var radky := []
	var den := int(floor(ted / DEN))
	for d in range(den - max_posun, int(floor(kraj / DEN)) + 1):
		var aktivni := profil(d)
		for z: Array in zastaveni_na_stanovisti[stanice]:
			if not aktivni.has(z[0]):
				continue
			var spoj: Dictionary = z[1]
			var plan: float = d * DEN + spoj.casy[z[2] * 2 + 1]
			if plan < ted or plan >= kraj:
				continue
			radky.append({"cas": plan, "linka": spoj.trasa.linka, "typ": spoj.trasa.typ, "cil": spoj.cil})
	radky.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.cas < b.cas)
	return {"stanoviste": stanoviste[stanice][0], "kod": stanoviste[stanice][3], "radky": radky.slice(0, pocet),
		"prestup": prestup(stanice)}


## Nejbližší přestup ze stanoviště (8–220 m, podle minimální doby a vzdálenosti), nebo {}.
func prestup(stanice: int) -> Dictionary:
	var nej := {}
	var st: Array = stanoviste[stanice]
	for p: Dictionary in prestupy[stanice]:
		var c: Array = stanoviste[p.kam]
		var metry := roundi(Vector2(c[1] - st[1], c[2] - st[2]).length())
		var kod: String = c[3]
		var nastupiste := kod.get_slice("/", 1) if kod.contains("/") else ""
		if metry > 220 or metry <= 8 or (c[0] == st[0] and nastupiste == ""):
			continue
		if nej.is_empty() or p.minimum < nej.minimum or (p.minimum == nej.minimum and metry < nej.metry):
			nej = {"nazev": c[0], "nastupiste": nastupiste, "metry": metry, "minimum": p.minimum}
	return nej


static func format_cas(sekundy: float) -> String:
	var v := fposmod(sekundy, DEN)
	return "%d:%02d" % [int(v / 3600), int(fmod(v, 3600) / 60)]
