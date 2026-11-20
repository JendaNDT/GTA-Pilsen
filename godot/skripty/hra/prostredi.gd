@tool
class_name Prostredi
extends Node3D
## Slunce, obloha, mlha, počasí a noční svícení oken podle data a hodiny v Plzni.
## Barvy a průběhy přebírá z předlohy (src/world/scene.js, setHour; src/game/game.js, updateWeather).

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

## Počasí (déšť, sníh, mlha, mokro); režim "jasno" vypne proměnlivé počasí.
var pocasi := Pocasi.new()
## Hustota srážek podle kvality (0 = vypnuto).
var hustota_srazek := 0.6:
	set(v):
		hustota_srazek = v
		_obnov()
## Vypínač kapek a vloček (mokro, sníh a mlha zůstávají).
var srazky_zapnute := true:
	set(v):
		srazky_zapnute = v
		_obnov()
var slunce_smer := Vector3.UP
var noc := 0.0
var den_podil := 1.0
var _svetlo: DirectionalLight3D
var _mesic: DirectionalLight3D
var _env: Environment
var _obloha: ProceduralSkyMaterial
var _we: WorldEnvironment
var _srazky: Srazky
var _mraky: NoiseTexture2D


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
	# oblaka: šum na obloze, jejich množství řídí počasí
	var sum := FastNoiseLite.new()
	sum.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	sum.frequency = 0.006
	sum.fractal_octaves = 4
	var mraky := NoiseTexture2D.new()
	mraky.width = 512
	mraky.height = 256
	mraky.seamless = true
	mraky.noise = sum
	var rampa := Gradient.new()
	rampa.set_color(0, Color(0, 0, 0))
	rampa.set_offset(0, 0.45)
	rampa.set_color(1, Color(1, 1, 1))
	rampa.set_offset(1, 0.8)
	mraky.color_ramp = rampa
	_obloha.sky_cover = mraky
	_mraky = mraky
	_srazky = Srazky.new()
	_srazky.name = "Srazky"
	add_child(_srazky, false, Node.INTERNAL_MODE_FRONT)
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


## Počká, až se vygeneruje textura oblaků (pro snímky).
func pripraveno() -> void:
	if _mraky and _mraky.get_image() == null:
		await _mraky.changed


## Režim počasí: "promenlive" nebo "jasno".
func nastav_pocasi(rezim: String) -> void:
	pocasi.rezim = "jasno" if rezim == "jasno" else "promenlive"
	_obnov()


func _obnov() -> void:
	if _svetlo == null:
		return
	var h := hodina
	pocasi.obnov(den * 86400.0 + h * 3600.0)
	var promenlive := pocasi.rezim != "jasno"
	var mraky := pocasi.oblacnost if promenlive else 0.41
	var zatazeno := maxf(0.0, mraky - 0.41)
	slunce_smer = Slunce.smer(den, h)
	var elev := slunce_smer.y
	den_podil = smoothstep(-0.16, 0.19, elev)
	var soumrak := 1.0 - smoothstep(0.035, 0.24, absf(elev + 0.025))
	noc = 1.0 - smoothstep(-0.17, 0.04, elev)
	var obzor := Color("b4cfe6").lerp(Color("f0a060"), soumrak * 0.85).lerp(Color("121a2c"), 1.0 - den_podil)
	obzor = obzor.lerp(Color("9babb3") if den_podil > 0.5 else Color("202733"), zatazeno * 1.3)
	var vrch := Color("3a7fd0").lerp(Color("050915"), 1.0 - den_podil)
	vrch = vrch.lerp(Color("7d8a93").lerp(Color("0b0f18"), 1.0 - den_podil), zatazeno * 1.2)
	var mrak := Color.WHITE.lerp(Color("ffc089"), soumrak * 0.8).lerp(Color("1b2338"), 1.0 - den_podil)
	mrak = mrak.lerp(Color(0.3, 0.32, 0.36) * mrak, clampf(zatazeno * 1.6, 0.0, 1.0))
	_obloha.sky_cover_modulate = Color(mrak.r, mrak.g, mrak.b, clampf(0.2 + mraky * 0.75, 0.0, 1.0))
	_obloha.sky_top_color = vrch
	_obloha.sky_horizon_color = obzor
	_obloha.ground_horizon_color = obzor
	_obloha.ground_bottom_color = Color("5b5a4a").lerp(Color("0c1120"), 1.0 - den_podil)
	_obloha.sun_angle_max = 8.0
	_obloha.sky_curve = 0.12
	_obloha.sky_energy_multiplier = (0.25 + 0.75 * den_podil) * (1.0 - zatazeno * 0.55)
	_svetlo.light_color = Color("fff0d8").lerp(Color("ffa05a"), soumrak)
	_svetlo.light_energy = 1.6 * maxf(0.08, 1.0 - zatazeno * 1.6) * smoothstep(-0.06, 0.19, elev)
	_svetlo.visible = elev > -0.06
	# pod zataženou oblohou stíny slábnou
	_svetlo.shadow_opacity = (0.43 + 0.48 * den_podil * (1.0 - soumrak * 0.5)) * clampf(1.0 - zatazeno * 1.4, 0.15, 1.0)
	if slunce_smer.length() > 0.001:
		var smer := -slunce_smer.normalized()
		var nahoru := Vector3.UP if absf(smer.y) < 0.99 else Vector3.FORWARD
		_svetlo.global_transform = Transform3D(Basis.looking_at(smer, nahoru), Vector3.ZERO)
	_mesic.light_energy = 0.18 * noc
	_mesic.visible = noc > 0.05
	# rozptýlené světlo jako polokoule v předloze: teplé shora, méně modré oblohy
	_env.ambient_light_sky_contribution = 0.35
	_env.ambient_light_color = Color("ffe9d5").lerp(Color("6f83c0"), 1.0 - den_podil)
	_env.ambient_light_energy = (0.35 + 0.55 * den_podil) * (1.0 - zatazeno * 0.3)
	_env.fog_light_color = obzor
	# hustá mlha zkrátí dohled (scene.js: near × (1 − 0,96 mlha), far × (1 − 0,83 mlha))
	_env.fog_depth_begin = dohled * 0.55 * (1.0 - 0.96 * pocasi.mlha)
	_env.fog_depth_end = dohled * 1.05 * (1.0 - 0.83 * pocasi.mlha)
	_env.fog_density = 0.9
	# mlha zakryje oblohu jen při mlhavém počasí (jinak je vidět modř a oblaka)
	_env.fog_sky_affect = 0.15 + 0.85 * pocasi.mlha
	_env.tonemap_exposure = 1.0 + noc * 0.6
	var r := rozvrh_oken(h)
	RenderingServer.global_shader_parameter_set("noc", noc)
	RenderingServer.global_shader_parameter_set("okna", Vector4(r.x, r.y, r.z, 1.0))
	RenderingServer.global_shader_parameter_set("mokro", pocasi.mokro)
	RenderingServer.global_shader_parameter_set("snih", pocasi.snih)
	_srazky.nastav(pocasi.dest, pocasi.vlocky, hustota_srazek if srazky_zapnute else 0.0)
