class_name Rizeni
extends RefCounted
## Řízení dopravy převzaté z předlohy (data/svet/doprava.bin): skupiny semaforů, pravidla na hranách
## grafu (semafor, stopka, dej přednost), přechody, návěstidla a značky. Fáze semaforů počítá
## stejně jako Traffic.phase v src/game/traffic.js.

const SEMAFOR := 0
const STOPKA := 1
const PREDNOST := 2

static var _instance: Rizeni

var skupiny: Array = []        ## [zelená, má druhou osu, posun, vyklizení, počet přechodů, x, z]
var pravidla := {}             ## hrana -> [[s, druh, skupina, osa], …] seřazené podle s
var prechody := PackedFloat32Array()
var hlavy := PackedFloat32Array()   ## x, y, z, tx, tz, osa, skupina, chodci
var znacky := PackedFloat32Array()  ## x, y, z, tx, tz, druh
var hlavy_dlazdice := {}       ## ci -> indexy návěstidel
var znacky_dlazdice := {}
var cas := 0.0                 ## hodiny semaforů (s)


static func nacti() -> Rizeni:
	if _instance:
		return _instance
	var surova := FileAccess.get_file_as_bytes(Mapa.SLOZKA + "doprava.bin")
	var r := Rizeni.new()
	if surova.is_empty():
		_instance = r
		return r
	var d: Dictionary = bytes_to_var(surova.decompress_dynamic(-1, FileAccess.COMPRESSION_DEFLATE))
	r.skupiny = d.skupiny
	var p: PackedInt32Array = d.pravidla
	for i in range(0, p.size(), 5):
		var e := p[i]
		if not r.pravidla.has(e):
			r.pravidla[e] = []
		r.pravidla[e].append([p[i + 1] * 0.01, p[i + 2], p[i + 3], p[i + 4]])
	for e: int in r.pravidla:
		r.pravidla[e].sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	r.prechody = d.prechody
	r.hlavy = d.hlavy
	r.znacky = d.znacky
	for i in range(0, r.hlavy.size(), 8):
		var ci := Mapa.index_dlazdice(r.hlavy[i], r.hlavy[i + 2])
		if not r.hlavy_dlazdice.has(ci):
			r.hlavy_dlazdice[ci] = []
		r.hlavy_dlazdice[ci].append(i / 8)
	for i in range(0, r.znacky.size(), 6):
		var ci := Mapa.index_dlazdice(r.znacky[i], r.znacky[i + 2])
		if not r.znacky_dlazdice.has(ci):
			r.znacky_dlazdice[ci] = []
		r.znacky_dlazdice[ci].append(i / 6)
	_instance = r
	return r


## Fáze skupiny: "green0", "green1", "amber0", "amber1", "walk" nebo "red".
func faze(skupina: int, t := -1.0) -> String:
	if skupina < 0 or skupina >= skupiny.size():
		return "off"
	if t < 0.0:
		t = cas
	var g: Array = skupiny[skupina]
	var zelena: float = g[0]
	var silnice := zelena + 5.0
	var vozidla := silnice * (2.0 if g[1] else 1.0)
	var chuze := 9.0 if g[4] > 0 else 0.0
	var start_chuze := vozidla + (2.0 if chuze > 0.0 else 0.0)
	var tt := fmod(t + float(g[2]), start_chuze + chuze + float(g[3]) + 3.0)
	if tt < vozidla:
		var osa := int(tt / silnice)
		var uvnitr := fmod(tt, silnice)
		if uvnitr < zelena:
			return "green%d" % osa
		if uvnitr < zelena + 2.0:
			return "amber%d" % osa
	if tt >= start_chuze and tt < start_chuze + chuze:
		return "walk"
	return "red"


## Barva návěstidla: "green", "amber", "red" (pro chodce jen green/red).
func svetlo(skupina: int, osa: int, chodci := false) -> String:
	var f := faze(skupina)
	if f == "off":
		return "off"
	if chodci:
		return "green" if f == "walk" else "red"
	if f == "green%d" % osa:
		return "green"
	return "amber" if f == "amber%d" % osa else "red"


## Nejbližší pravidlo na hraně e za polohou s (do dosahu): [s, druh, skupina, osa] nebo [].
func pravidlo_vpred(e: int, s: float, dosah: float) -> Array:
	for c: Array in pravidla.get(e, []):
		if c[0] >= s - 0.5 and c[0] <= s + dosah:
			return c
	return []
