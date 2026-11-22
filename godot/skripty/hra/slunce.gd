class_name Slunce
extends RefCounted
## Poloha slunce nad Plzní (převod src/world/solar.js, výpočet NOAA).
## Den = počet dnů od 1. 1. 1970 (UTC), hodina = místní občanský čas v Plzni.

const SIRKA := 49.7475
const DELKA := 13.3776


static func _je_prestupny(rok: int) -> bool:
	return rok % 4 == 0 and (rok % 100 != 0 or rok % 400 == 0)


## Den od roku 1970 pro datum (rok, měsíc 1–12, den 1–31).
static func den_z_data(rok: int, mesic: int, den: int) -> int:
	return int(Time.get_unix_time_from_datetime_dict({"year": rok, "month": mesic, "day": den, "hour": 0}) / 86400)


static func datum(den: int) -> Dictionary:
	return Time.get_datetime_dict_from_unix_time(den * 86400)


## Posledni neděle v měsíci (den od roku 1970).
static func _posledni_nedele(rok: int, mesic: int) -> int:
	var posledni := den_z_data(rok, mesic + 1, 1) - 1 if mesic < 12 else den_z_data(rok + 1, 1, 1) - 1
	# 1. 1. 1970 byl čtvrtek (weekday 4)
	var dt := Time.get_datetime_dict_from_unix_time(posledni * 86400)
	return posledni - int(dt.weekday)


## Posun občanského času v Plzni proti UTC (1 zimní, 2 letní čas).
static func posun_utc(den: int) -> int:
	var rok: int = datum(den).year
	var od := _posledni_nedele(rok, 3)
	var do_ := _posledni_nedele(rok, 10)
	return 2 if den >= od and den < do_ else 1


## Jednotkový směr od pozorovatele ke slunci (x východ, y nahoru, z jih).
static func smer(den: int, hodina: float) -> Vector3:
	var utc := posun_utc(den)
	var rok: int = datum(den).year
	var zacatek := den_z_data(rok, 1, 1)
	var dni := 366.0 if _je_prestupny(rok) else 365.0
	var uhel := TAU / dni * (den - zacatek + (hodina - utc - 12.0) / 24.0)
	var c := cos(uhel)
	var s := sin(uhel)
	var c2 := cos(2.0 * uhel)
	var s2 := sin(2.0 * uhel)
	var rovnice := 229.18 * (0.000075 + 0.001868 * c - 0.032077 * s - 0.014615 * c2 - 0.040849 * s2)
	var deklinace := 0.006918 - 0.399912 * c + 0.070257 * s - 0.006758 * c2 + 0.000907 * s2 \
		- 0.002697 * cos(3.0 * uhel) + 0.00148 * sin(3.0 * uhel)
	var hodinovy := deg_to_rad(((hodina - utc) * 60.0 + rovnice + 4.0 * DELKA - 720.0) / 4.0)
	var lat := deg_to_rad(SIRKA)
	var cd := cos(deklinace)
	var sd := sin(deklinace)
	var polednik := cd * cos(hodinovy)
	return Vector3(-cd * sin(hodinovy), sin(lat) * sd + cos(lat) * polednik, sin(lat) * polednik - cos(lat) * sd)
