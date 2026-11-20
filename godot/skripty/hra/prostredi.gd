@tool
class_name Prostredi
extends Node3D
## Slunce, obloha, mlha a noční svícení oken podle data a hodiny v Plzni.
## Barvy a průběhy přebírá z předlohy (src/world/scene.js, setHour).

const DOMOVY := [0.15, 0.09, 0.07, 0.06, 0.08, 0.16, 0.28, 0.27, 0.14, 0.1, 0.09, 0.1, 0.12, 0.11, 0.12,
	0.16, 0.28, 0.43, 0.6, 0.72, 0.78, 0.72, 0.56, 0.34]

@export_range(0.0, 24.0, 0.05) var hodina := 14.0:
	set(v):
		hodina = v
		_obnov()
## Den od 1. 1. 1970. Výchozí je 15. 6. 2026.
@export var den := 20619:
	set(v):
		den = v
		_obnov()
@export var dohled := 1000.0:
	set(v):
		dohled = v
		_obnov()

var slunce_smer := Vector3.UP
var noc := 0.0
var den_podil := 1.0
var _svetlo: DirectionalLight3D
var _mesic: DirectionalLight3D
var _env: Environment
var _obloha: ProceduralSkyMaterial
var _we: WorldEnvironment


func _ready() -> void:
	_svetlo = DirectionalLight3D.new()
	_svetlo.name = "Slunce"
	_svetlo.shadow_enabled = true
	_svetlo.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	_svetlo.directional_shadow_max_distance = 220.0
	_svetlo.shadow_bias = 0.06
	_svetlo.shadow_normal_bias = 1.5
	add_child(_svetlo, false, Node.INTERNAL_MODE_FRONT)
	_mesic = DirectionalLight3D.new()
	_mesic.name = "Mesic"
	_mesic.light_color = Color(0.55, 0.62, 0.85)
	_mesic.rotation_degrees = Vector3(-50, 30, 0)
	add_child(_mesic, false, Node.INTERNAL_MODE_FRONT)
	_obloha = ProceduralSkyMaterial.new()
	var sky := Sky.new()
	sky.sky_material = _obloha
	_env = Environment.new()
	_env.background_mode = Environment.BG_SKY
	_env.sky = sky
	_env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	_env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	_env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_env.tonemap_exposure = 1.0
	_env.fog_enabled = true
	_env.fog_mode = Environment.FOG_MODE_DEPTH
	_env.glow_enabled = true
	_env.glow_intensity = 0.35
	_env.glow_bloom = 0.02
	_we = WorldEnvironment.new()
	_we.environment = _env
	add_child(_we, false, Node.INTERNAL_MODE_FRONT)
	_obnov()


## Stíny slunce do vzdálenosti (m); 0 = bez stínů (nízká kvalita).
func nastav_stiny(vzdalenost: float) -> void:
	if _svetlo == null:
		return
	_svetlo.shadow_enabled = vzdalenost > 0.0
	_svetlo.directional_shadow_max_distance = maxf(50.0, vzdalenost)


func nastav_zari(zapnout: bool) -> void:
	if _env:
		_env.glow_enabled = zapnout


static func rozvrh_oken(h: float) -> Vector3:
	var hh := fposmod(h, 24.0)
	var i := int(hh)
	var f := hh - i
	var dum: float = DOMOVY[i] + f * (DOMOVY[(i + 1) % 24] - DOMOVY[i])
	var kancelar := 0.05
	if hh >= 6.0 and hh < 8.0:
		kancelar = 0.05 + (hh - 6.0) * 0.36
	elif hh >= 8.0 and hh < 17.0:
		kancelar = 0.77
	elif hh >= 17.0 and hh < 20.0:
		kancelar = 0.77 - (hh - 17.0) * 0.22
	elif hh >= 20.0:
		kancelar = 0.06
	return Vector3(dum, kancelar, 0.87 if hh >= 7.0 and hh < 20.0 else 0.0)


func nastav_hodinu(h: float, d := -1) -> void:
	if d >= 0:
		den = d
	hodina = h


func _obnov() -> void:
	if _svetlo == null:
		return
	var h := hodina
	slunce_smer = Slunce.smer(den, h)
	var elev := slunce_smer.y
	den_podil = smoothstep(-0.16, 0.19, elev)
	var soumrak := 1.0 - smoothstep(0.035, 0.24, absf(elev + 0.025))
	noc = 1.0 - smoothstep(-0.17, 0.04, elev)
	var obzor := Color("b4cfe6").lerp(Color("f0a060"), soumrak * 0.85).lerp(Color("121a2c"), 1.0 - den_podil)
	var vrch := Color("3a7fd0").lerp(Color("050915"), 1.0 - den_podil)
	_obloha.sky_top_color = vrch
	_obloha.sky_horizon_color = obzor
	_obloha.ground_horizon_color = obzor
	_obloha.ground_bottom_color = Color("5b5a4a").lerp(Color("0c1120"), 1.0 - den_podil)
	_obloha.sun_angle_max = 8.0
	_obloha.sky_curve = 0.12
	_obloha.sky_energy_multiplier = 0.25 + 0.75 * den_podil
	_svetlo.light_color = Color("fff0d8").lerp(Color("ffa05a"), soumrak)
	_svetlo.light_energy = 1.6 * smoothstep(-0.06, 0.19, elev)
	_svetlo.visible = elev > -0.06
	_svetlo.shadow_opacity = 0.43 + 0.48 * den_podil * (1.0 - soumrak * 0.5)
	if slunce_smer.length() > 0.001:
		var smer := -slunce_smer.normalized()
		var nahoru := Vector3.UP if absf(smer.y) < 0.99 else Vector3.FORWARD
		_svetlo.global_transform = Transform3D(Basis.looking_at(smer, nahoru), Vector3.ZERO)
	_mesic.light_energy = 0.18 * noc
	_mesic.visible = noc > 0.05
	# rozptýlené světlo jako polokoule v předloze: teplé shora, méně modré oblohy
	_env.ambient_light_sky_contribution = 0.35
	_env.ambient_light_color = Color("ffe9d5").lerp(Color("6f83c0"), 1.0 - den_podil)
	_env.ambient_light_energy = 0.35 + 0.55 * den_podil
	_env.fog_light_color = obzor
	_env.fog_depth_begin = dohled * 0.55
	_env.fog_depth_end = dohled * 1.05
	_env.fog_density = 0.9
	_env.tonemap_exposure = 1.0 + noc * 0.6
	var r := rozvrh_oken(h)
	RenderingServer.global_shader_parameter_set("noc", noc)
	RenderingServer.global_shader_parameter_set("okna", Vector4(r.x, r.y, r.z, 1.0))
