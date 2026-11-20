extends SceneTree
## Zapíše výchozí ovládání do project.godot (Projekt → Nastavení projektu → Mapa vstupů).
## Spuštění: godot --headless --path godot -s res://editor/nastav_ovladani.gd
## Existující akce přepíše výchozími klávesami. Ruční úpravy dělejte pak v editoru.

const AKCE := {
	"vpred": [KEY_W, KEY_UP],
	"vzad": [KEY_S, KEY_DOWN],
	"vlevo": [KEY_A, KEY_LEFT],
	"vpravo": [KEY_D, KEY_RIGHT],
	"beh": [KEY_SHIFT],
	"skok_brzda": [KEY_SPACE],
	"nastoupit": [KEY_F, KEY_E],
	"kamera": [KEY_C],
	"klakson": [KEY_H],
	"svetla": [KEY_L],
	"na_silnici": [KEY_R],
	"mapa": [KEY_M],
	"menu": [KEY_ESCAPE],
	"fotorezim": [KEY_O],
	"posun_casu": [KEY_N],
	"zakazka": [KEY_J],
	"ladeni": [KEY_F3],
}

const OVLADAC := {
	"nastoupit": JOY_BUTTON_Y,
	"skok_brzda": JOY_BUTTON_A,
	"beh": JOY_BUTTON_B,
	"kamera": JOY_BUTTON_BACK,
	"mapa": JOY_BUTTON_DPAD_UP,
	"menu": JOY_BUTTON_START,
	"klakson": JOY_BUTTON_LEFT_STICK,
}


func _init() -> void:
	for akce: String in AKCE:
		var udalosti: Array = []
		for klavesa: int in AKCE[akce]:
			var e := InputEventKey.new()
			e.physical_keycode = klavesa
			udalosti.append(e)
		if OVLADAC.has(akce):
			var tl := InputEventJoypadButton.new()
			tl.button_index = OVLADAC[akce]
			udalosti.append(tl)
		ProjectSettings.set_setting("input/" + akce, {"deadzone": 0.2, "events": udalosti})
	ProjectSettings.save()
	print("Ovládání zapsáno: ", AKCE.size(), " akcí")
	quit()
