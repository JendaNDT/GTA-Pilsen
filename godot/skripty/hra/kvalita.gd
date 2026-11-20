class_name Kvalita
extends RefCounted
## Předvolby grafické kvality (podle PROFILES v src/game/graphics-quality.js).
## „auto“ začne podle zařízení a po 10 sekundách hraní případně sníží kvalitu podle snímků za sekundu.

const PREDVOLBY := {
	"nizka": {"nazev": "Nízká", "provoz": 12, "chodci": 8, "parkovani": 26, "dohled": 620.0, "stiny": 0.0, "msaa": Viewport.MSAA_DISABLED, "meritko": 0.75, "stromy": true, "zare": false, "srazky": 0.35},
	"stredni": {"nazev": "Střední", "provoz": 26, "chodci": 16, "parkovani": 46, "dohled": 1100.0, "stiny": 160.0, "msaa": Viewport.MSAA_2X, "meritko": 1.0, "stromy": true, "zare": true, "srazky": 0.6},
	"vysoka": {"nazev": "Vysoká", "provoz": 42, "chodci": 26, "parkovani": 70, "dohled": 1600.0, "stiny": 260.0, "msaa": Viewport.MSAA_4X, "meritko": 1.0, "stromy": true, "zare": true, "srazky": 1.0},
}
const PORADI := ["nizka", "stredni", "vysoka"]


static func vychozi() -> String:
	return "nizka" if DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") else "vysoka"


## Použije předvolbu na svět, prostředí a obraz.
static func pouzij(nazev: String, svet: Svet, prostredi: Prostredi, viewport: Viewport) -> String:
	if not PREDVOLBY.has(nazev):
		nazev = vychozi()
	var p: Dictionary = PREDVOLBY[nazev]
	svet.dohled = p.dohled
	svet.stromy = p.stromy
	prostredi.dohled = p.dohled
	prostredi.nastav_stiny(p.stiny)
	prostredi.nastav_zari(p.zare)
	prostredi.hustota_srazek = p.srazky
	svet.orto_kapacita = 12 if nazev == "nizka" else 24
	viewport.msaa_3d = p.msaa
	viewport.scaling_3d_scale = p.meritko
	var hra := svet.get_parent() as Hra
	if hra:
		hra.doprava.pocet_aut = p.provoz
		hra.doprava.pocet_zaparkovanych = p.parkovani
		hra.chodci.pocet = p.chodci
	var kamera := viewport.get_camera_3d()
	if kamera:
		kamera.far = p.dohled * 1.35
	return nazev
