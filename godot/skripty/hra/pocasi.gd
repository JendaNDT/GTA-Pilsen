class_name Pocasi
extends RefCounted
## Počasí převzaté ze src/world/weather.js: herní měsíční váhy pro západní Čechy (ne předpověď),
## bloky po 3 hodinách se stejným výsledkem pro stejný čas, plynulý přechod 10–30 min.
## Mokro vyschne do 6 hodin, sníh vydrží do druhého dne. Přilnavost: mokro 70 %, sníh 35 %.

## [průměrná teplota, podíl srážek, mlhy a zataženo]
const MESICE := [[-1, .26, .16, .32], [0, .23, .12, .31], [4, .20, .10, .28], [9, .22, .06, .23],
	[13, .27, .04, .20], [17, .28, .04, .18], [19, .27, .03, .16], [18, .24, .04, .16],
	[14, .22, .08, .20], [9, .22, .15, .25], [4, .25, .17, .31], [0, .26, .16, .32]]
## [oblačnost, déšť, vločky, mlha]
const STAVY := {
	"clear": [0.08, 0.0, 0.0, 0.0], "partly": [0.41, 0.0, 0.0, 0.0], "cloudy": [0.9, 0.0, 0.0, 0.0],
	"rain": [0.93, 0.78, 0.0, 0.22], "storm": [1.0, 1.0, 0.0, 0.37],
	"fog": [0.64, 0.0, 0.0, 1.0], "snow": [0.94, 0.0, 0.9, 0.36],
}
const NAZVY := {"clear": "jasno", "partly": "polojasno", "cloudy": "zataženo", "rain": "déšť",
	"storm": "bouřka", "fog": "mlha", "snow": "sněžení"}
const BLOK := 3 * 3600
const KROK := 300

var rezim := "promenlive"       ## nebo "jasno" (vždy jasno)
## Ladění: pevný stav (rain, snow, fog …); změna zahodí dříve spočítané bloky.
var vynuceno := "":
	set(v):
		vynuceno = v if STAVY.has(v) else ""
		_bloky.clear()
		_povrchy.clear()
var druh := "clear"
var oblacnost := 0.08
var dest := 0.0
var vlocky := 0.0
var mlha := 0.0
var teplota := 10.0
var mokro := 0.0
var snih := 0.0
var _bloky := {}
var _povrchy := {}


static func _imul(a: int, b: int) -> int:
	a &= 0xFFFFFFFF
	b &= 0xFFFFFFFF
	var lo := (a & 0xFFFF) * b
	var hi := ((a >> 16) * b) & 0xFFFF
	return (lo + (hi << 16)) & 0xFFFFFFFF


## Hash jako random(id, salt) v předloze (výsledek 0–1).
static func nahoda(id: int, sul: int) -> float:
	var h := _imul((id ^ sul) & 0xFFFFFFFF, 0x85ebca6b)
	h = _imul(h ^ (h >> 13), 0xc2b2ae35)
	return float((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


func blok(id: int) -> Dictionary:
	if _bloky.has(id):
		return _bloky[id]
	var den := floori(id / 8.0)
	var m: Array = MESICE[int(Slunce.datum(den).month) - 1]
	var t: float = m[0] + (nahoda(den, 671) - 0.5) * 11.0
	var hod := nahoda(id, 827)
	var k := ""
	if hod < m[1]:
		k = "snow" if t < 1.0 else ("storm" if t > 15.0 and nahoda(id, 917) < 0.21 else "rain")
	elif hod < m[1] + m[2]:
		k = "fog"
	elif hod < m[1] + m[2] + m[3]:
		k = "cloudy"
	else:
		k = "clear" if nahoda(id, 531) < 0.49 else "partly"
	if vynuceno != "":
		k = vynuceno
		if k == "snow":
			t = -3.0
	var b := {"druh": k, "teplota": t, "prechod": 600.0 + 1200.0 * nahoda(id, 5318)}
	_bloky[id] = b
	return b


func _atmosfera(cas: float) -> Dictionary:
	var id := floori(cas / BLOK)
	var ted := blok(id)
	var pred := blok(id - 1)
	var t := clampf((cas - id * BLOK) / float(ted.prechod), 0.0, 1.0)
	var f := t * t * (3.0 - 2.0 * t)
	var a: Array = STAVY[pred.druh]
	var b: Array = STAVY[ted.druh]
	return {"druh": pred.druh if f < 0.5 else ted.druh, "oblacnost": lerpf(a[0], b[0], f), "dest": lerpf(a[1], b[1], f),
		"vlocky": lerpf(a[2], b[2], f), "mlha": lerpf(a[3], b[3], f), "teplota": lerpf(pred.teplota, ted.teplota, f)}


func _povrch(krok: int) -> Vector2:
	if _povrchy.has(krok):
		return _povrchy[krok]
	var m := 0.0
	var s := 0.0
	for zpet in range(288, 0, -1):
		var st := _atmosfera((krok - zpet + 0.5) * KROK)
		m = clampf(m + st.dest * 0.18 - (1.0 - st.dest) * (0.014 + maxf(0.0, st.teplota) * 0.001), 0.0, 1.0)
		s = clampf(s + st.vlocky * 0.057 - (1.0 - st.vlocky) * (0.004 + maxf(0.0, st.teplota) * 0.006), 0.0, 1.0)
	_povrchy[krok] = Vector2(m, s)
	return _povrchy[krok]


## Spočítá počasí pro herní čas (sekundy od 1. 1. 1970).
func obnov(cas: float) -> void:
	if rezim == "jasno":
		druh = "clear"
		oblacnost = 0.08
		dest = 0.0
		vlocky = 0.0
		mlha = 0.0
		mokro = 0.0
		snih = 0.0
		return
	if _bloky.size() > 80:
		_bloky.clear()
	if _povrchy.size() > 32:
		_povrchy.clear()
	var st := _atmosfera(cas)
	druh = st.druh
	oblacnost = st.oblacnost
	dest = st.dest
	vlocky = st.vlocky
	mlha = st.mlha
	teplota = st.teplota
	var krok := floori(cas / KROK)
	var a := _povrch(krok)
	var b := _povrch(krok + 1)
	var t := cas / KROK - krok
	mokro = lerpf(a.x, b.x, t)
	snih = lerpf(a.y, b.y, t)


## Přilnavost povrchu (1 = sucho), surfaceGrip v předloze.
func prilnavost() -> float:
	return lerpf(lerpf(1.0, 0.7, mokro), 0.35, snih)
