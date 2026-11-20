class_name Vstup
extends RefCounted
## Společný vstup z klávesnice, herního ovladače a dotykových ovládacích prvků.
## Dotykové ovládání (skripty/ui/dotyk.gd) zapisuje do statických proměnných níže.

static var dotyk_pohyb := Vector2.ZERO      ## x = vpravo, y = vpřed (−1 … 1)
static var dotyk_beh := false
static var dotyk_brzda := false
static var dotyk_kamera := Vector2.ZERO     ## posun pohledu za snímek (pixely)
static var aktivni_dotyk := false


## Požadovaný pohyb: x = doprava, y = dopředu.
static func pohyb() -> Vector2:
	var v := Vector2(Input.get_axis("vlevo", "vpravo"), Input.get_axis("vzad", "vpred"))
	var joy := Vector2(Input.get_joy_axis(0, JOY_AXIS_LEFT_X), -Input.get_joy_axis(0, JOY_AXIS_LEFT_Y))
	if joy.length() > 0.2:
		v += joy
	v += dotyk_pohyb
	return v.limit_length(1.0)


static func beh() -> bool:
	return Input.is_action_pressed("beh") or dotyk_beh


static func brzda() -> bool:
	return Input.is_action_pressed("skok_brzda") or dotyk_brzda


## Plyn a brzda z ovladače (pravá/levá spoušť), jinak z pohybu.
static func plyn() -> float:
	var t := Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT) - Input.get_joy_axis(0, JOY_AXIS_TRIGGER_LEFT)
	if absf(t) > 0.1:
		return clampf(t, -1.0, 1.0)
	return pohyb().y
