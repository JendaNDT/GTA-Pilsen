class_name Kvalita
extends RefCounted
## Předvolby grafické kvality (podle PROFILES v src/game/graphics-quality.js).
## „auto“ začne podle zařízení a po 10 sekundách hraní případně sníží kvalitu podle snímků za sekundu.

const PREDVOLBY := {
	"nizka": {"nazev": "Nízká", "dohled": 620.0, "stiny": 0.0, "msaa": Viewport.MSAA_DISABLED, "meritko": 0.75, "stromy": true, "zare": false},
	"stredni": {"nazev": "Střední", "dohled": 1100.0, "stiny": 160.0, "msaa": Viewport.MSAA_2X, "meritko": 1.0, "stromy": true, "zare": true},
	"vysoka": {"nazev": "Vysoká", "dohled": 1600.0, "stiny": 260.0, "msaa": Viewport.MSAA_4X, "meritko": 1.0, "stromy": true, "zare": true},
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
	viewport.msaa_3d = p.msaa
	viewport.scaling_3d_scale = p.meritko
	var kamera := viewport.get_camera_3d()
	if kamera:
		kamera.far = p.dohled * 1.35
	return nazev
