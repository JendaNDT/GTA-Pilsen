class_name Ulozeni
extends RefCounted
## Uložená hra v souboru JSON (user://ulozeni.json; ve webové verzi v úložišti prohlížeče).
## Každá položka má bezpečnou výchozí hodnotu, takže starší uložení se načtou i po přidání nových.

const VERZE := 1

## Cesta k souboru (zkoušky ji přesměrují).
static var soubor := "user://ulozeni.json"

const VYCHOZI := {
	"verze": VERZE,
	"penize": 500,
	"hrac": {},                 ## {x, y, z, natoceni, rezim}
	"auto": {},                 ## {typ, barva, x, y, z, natoceni}
	"cas": {"zivy": true, "den": -1, "hodina": -1.0},
	"objevene": [],
	"statistiky": {},
	"nastaveni": {"kvalita": "auto", "zvuk": true, "hodiny": true, "pocasi": "promenlive", "srazky": true},
	"garaz": {},
	"zakazky": {},
	"smeny": {},
}


static func existuje() -> bool:
	return FileAccess.file_exists(soubor)


## Načte uloženou hru doplněnou o výchozí hodnoty (nebo výchozí stav, když uložení chybí).
static func nacti() -> Dictionary:
	var d: Dictionary = VYCHOZI.duplicate(true)
	if not existuje():
		return d
	var text := FileAccess.get_file_as_string(soubor)
	var data: Variant = JSON.parse_string(text)
	if not data is Dictionary:
		push_warning("Uložená hra je poškozená, začíná se znovu.")
		return d
	return _dopln(d, data)


static func _dopln(vychozi: Dictionary, data: Dictionary) -> Dictionary:
	var out := vychozi.duplicate(true)
	for k: String in data:
		if out.has(k) and out[k] is Dictionary and data[k] is Dictionary and not (out[k] as Dictionary).is_empty():
			out[k] = _dopln(out[k], data[k])
		else:
			out[k] = data[k]
	return out


static func uloz(d: Dictionary) -> bool:
	d.verze = VERZE
	var docasny := soubor + ".tmp"
	var f := FileAccess.open(docasny, FileAccess.WRITE)
	if f == null:
		push_warning("Hru se nepodařilo uložit (%s)." % error_string(FileAccess.get_open_error()))
		return false
	f.store_string(JSON.stringify(d, "\t"))
	f.close()
	# Zápis přes dočasný soubor: při výpadku zůstane předchozí uložení celé.
	return DirAccess.rename_absolute(docasny, soubor) == OK


static func smaz() -> void:
	if existuje():
		DirAccess.remove_absolute(soubor)
