@tool
extends EditorPlugin
## Panel „Plzeň“ v editoru (vpravo vedle Inspektoru).

var _panel: Control


func _enter_tree() -> void:
	_panel = preload("res://addons/plzen/panel.gd").new()
	_panel.name = "Plzeň"
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, _panel)


func _exit_tree() -> void:
	if _panel:
		remove_control_from_docks(_panel)
		_panel.queue_free()
		_panel = null
