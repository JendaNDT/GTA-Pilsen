@tool
class_name Srazky
extends MeshInstance3D
## Déšť a sníh kolem kamery (src/fx/precipitation.js): pevné pole kapek ve světě, které se
## posouvá s kamerou (fract), takže kapky při pohybu nesklouzávají s pohledem. Jedno vykreslení.

const NEJVIC := 768

var _mat: ShaderMaterial


func _ready() -> void:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix, shadows_disabled, fog_disabled;
uniform float vlocky = 0.0;     // 0 déšť, 1 sníh
uniform float pocet = 0.0;      // kolik kapek je vidět
uniform float cas = 0.0;
varying float okraj;
void vertex() {
	float i = COLOR.a * 1024.0;
	vec3 zarodek = COLOR.rgb;
	float posun = cas * mix(18.0, 1.8, vlocky);
	vec3 pole = vec3(27.0, 18.0, 27.0);
	vec3 vitr = vec3(posun * 0.095, -posun, posun * 0.035);
	vec3 kamera = CAMERA_POSITION_WORLD;
	vec3 o = (fract((zarodek * pole + vitr - kamera) / pole) - 0.5) * pole;
	vec3 stred = kamera + o;
	vec3 vpravo = INV_VIEW_MATRIX[0].xyz;
	float sirka = mix(0.018, 0.055, vlocky);
	float delka = mix(0.42, 0.048, vlocky);
	vec3 p = stred + vpravo * VERTEX.x * sirka + vec3(-0.095, 1.0, -0.035) * VERTEX.y * delka;
	if (i >= pocet) { p = kamera - vec3(0.0, 1000.0, 0.0); }
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p, 1.0);
	okraj = UV.x;
}
void fragment() {
	float hrana = clamp(1.0 - length(UV - 0.5) * 2.0, 0.0, 1.0);
	ALBEDO = mix(vec3(0.54, 0.66, 0.79), vec3(0.93, 0.96, 1.0), vlocky);
	ALPHA = hrana * mix(0.6, 0.94, vlocky);
}
"""
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	var v := PackedVector3Array()
	var uv := PackedVector2Array()
	var barvy := PackedColorArray()
	var idx := PackedInt32Array()
	var seed := 6487
	for i in NEJVIC:
		var z := Vector3.ZERO
		for k in 3:
			seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
			z[k] = float(seed) / 4294967296.0
		var b := v.size()
		for r in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
			v.append(Vector3(r.x, r.y, 0))
			uv.append(Vector2((r.x + 1.0) * 0.5, (r.y + 1.0) * 0.5))
			barvy.append(Color(z.x, z.y, z.z, float(i) / 1024.0))
		idx.append_array([b, b + 2, b + 1, b + 2, b + 3, b + 1])
	var a := []
	a.resize(Mesh.ARRAY_MAX)
	a[Mesh.ARRAY_VERTEX] = v
	a[Mesh.ARRAY_TEX_UV] = uv
	a[Mesh.ARRAY_COLOR] = barvy
	a[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a)
	m.surface_set_material(0, _mat)
	mesh = m
	# kapky jsou vždy kolem kamery
	custom_aabb = AABB(Vector3(-1e6, -1e4, -1e6), Vector3(2e6, 2e4, 2e6))
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visible = false


## dest, vlocky: síla deště a sněžení (0–1); hustota: podíl z nejvyššího počtu podle kvality.
func nastav(dest: float, vlocky: float, hustota: float) -> void:
	if _mat == null:
		return
	var celkem := dest + vlocky
	visible = celkem > 0.015 and hustota > 0.0
	if not visible:
		return
	_mat.set_shader_parameter("vlocky", vlocky / celkem)
	_mat.set_shader_parameter("pocet", minf(NEJVIC, ceilf(celkem * NEJVIC * hustota)))


func _process(_delta: float) -> void:
	if visible and _mat:
		_mat.set_shader_parameter("cas", fmod(Time.get_ticks_msec() / 1000.0, 3600.0))
