class_name Rytmus
extends RefCounted
## Denní rytmus provozu (src/game/traffic-rhythm.js). Měřené ulice mají hodinové křivky z dopravních
## detektorů města Plzně, ostatní odhad podle třídy silnice, centra a zastavěnosti. Hodinový medián
## platí uprostřed hodiny, mezi hodinami se plynule mísí (o půlnoci se sousedním dnem).

const CENTRUM := 1250.0

static var _instance: Rytmus

var krivky: Array = []             ## PackedFloat32Array 48 hodnot: pracovní den 0–23, víkend 0–23
var hrany := PackedInt32Array()    ## hrana -> měřená křivka (−1 = odhad)
var zastavba := PackedInt32Array() ## počet budov v dlaždici
var rokycany := Vector2(1e9, 1e9)
var dobriv := Vector2(1e9, 1e9)
var tridy := {"sekundarniSpojka": 4, "terciarniSpojka": 6, "obytna": 12}


static func nacti() -> Rytmus:
	if _instance:
		return _instance
	var r := Rytmus.new()
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + "rytmus.bin")
	if not surova.is_empty():
		var d: Dictionary = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
		r.krivky = d.krivky
		r.hrany = d.hrany
		r.zastavba = d.zastavba
		r.rokycany = Vector2(d.rokycany[0], d.rokycany[1])
		r.dobriv = Vector2(d.dobriv[0], d.dobriv[1])
		r.tridy = d.tridy
	_instance = r
	return r


## Činnost podle křivky v herním čase (hourlyActivity). Bez dat vrací 1.
func aktivita(krivka: int, den: int, hodina: float) -> float:
	if krivka < 0 or krivka >= krivky.size():
		return 1.0
	var k: PackedFloat32Array = krivky[krivka]
	var h := floori(hodina)
	var podil := hodina - h
	var rada := func(d: int) -> int: return 0 if JizdniRad.den_v_tydnu(d) < 5 else 24
	var ted: float = k[rada.call(den) + h]
	var jina := 0.0
	if podil < 0.5:
		jina = k[rada.call(den - (1 if h == 0 else 0)) + (h + 23) % 24]
	else:
		jina = k[rada.call(den + (1 if h == 23 else 0)) + (h + 1) % 24]
	return ted + (jina - ted) * absf(podil - 0.5)


func _v_centru(x: float, z: float) -> bool:
	return x * x + z * z <= CENTRUM * CENTRUM


func _region(x: float, z: float) -> float:
	if Vector2(x, z).distance_squared_to(dobriv) < 1300.0 * 1300.0:
		return 0.62
	if Vector2(x, z).distance_squared_to(rokycany) < 2400.0 * 2400.0:
		return 0.82
	return 1.0


func _osidleni(x: float, z: float) -> float:
	var ci := Mapa.index_dlazdice(x, z)
	var n := zastavba[ci] if ci >= 0 and ci < zastavba.size() else 0
	return minf(1.0, 0.48 + n / 90.0)


## Pravděpodobnost, že na hraně vznikne auto (carWeight).
func vaha_auta(g: Graf, e: int, den: int, hodina: float) -> float:
	if krivky.is_empty():
		return 1.0
	if e < hrany.size() and hrany[e] >= 0:
		return maxf(0.025, aktivita(hrany[e], den, hodina))
	var p := g.bod_na_hrane(e, g.h_delka[e] / 2.0, 0.0)
	var trida := g.trida[g.h_silnice[e]]
	var region := _region(p.x, p.y)
	if trida <= int(tridy.sekundarniSpojka):
		return maxf(0.06, aktivita(2, den, hodina) * 0.94 * region)
	if _v_centru(p.x, p.y) and trida <= int(tridy.terciarniSpojka):
		return aktivita(1, den, hodina) * 0.88
	return aktivita(0, den, hodina) * _osidleni(p.x, p.y) * 0.8 * region


## Hustota provozu kolem hráče (carDensity): váha nejbližší silnice v obou směrech.
func hustota_aut(g: Graf, x: float, z: float, den: int, hodina: float) -> float:
	if krivky.is_empty():
		return 1.0
	var h := g.nejblizsi_hrana(x, z, 50.0)
	if h.is_empty():
		return aktivita(0, den, hodina) * _osidleni(x, z) * _region(x, z)
	var e: int = h.hrana
	var hustota := vaha_auta(g, e, den, hodina)
	var o := Zakazky._opacna(g, e)
	return hustota if o < 0 else maxf(hustota, vaha_auta(g, o, den, hodina))


## Hustota chodců (pedestrianWeight): centrum, zastavěnost a odjezdy MHD do 20 minut.
func vaha_chodcu(x: float, z: float, den: int, hodina: float, odjezdu := 0) -> float:
	if krivky.is_empty():
		return 1.0
	var centrum := _v_centru(x, z)
	var meritko := 0.84 if centrum else _osidleni(x, z) * _region(x, z) * 0.74
	return minf(1.0, aktivita(1 if centrum else 0, den, hodina) * meritko + odjezdu * 0.09)
