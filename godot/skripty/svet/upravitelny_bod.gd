@tool
class_name UpravitelnyBod
extends Node3D
## Společný základ bodů, které vytváří importér z dat a autor je smí v editoru měnit
## (zastávky, místa k objevení…). Importér si v části „Převod“ pamatuje polohu, natočení
## a název z dat. Když se poloha nebo název liší, bere bod jako ručně upravený a nepřepíše ho.

## Stálé označení bodu v datech (např. číslo stanoviště 54717/2).
@export var id := ""
## Název (lze přejmenovat).
@export var nazev := "":
	set(v):
		nazev = v
		_nazev_zmenen()

@export_group("Převod (nastavuje importér)")
## Pořadí v převedených datech.
@export var poradi := -1
@export var gen_pozice := Vector3.ZERO
@export var gen_natoceni := 0.0
@export var gen_nazev := ""
## Bod už v datech není, ale autor ho upravil, proto zůstal.
@export var zastarala := false


## Liší se poloha nebo natočení od převodu?
func posunuta() -> bool:
	return position.distance_to(gen_pozice) > 0.05 or absf(wrapf(rotation.y - gen_natoceni, -PI, PI)) > 0.01


func prejmenovana() -> bool:
	return nazev != gen_nazev


## Přepsat v potomkovi, pokud se má změna názvu projevit na vzhledu.
func _nazev_zmenen() -> void:
	pass
