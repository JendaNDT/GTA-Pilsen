// Asfalt, čáry a koleje položené na terénu. Barva z vrcholu se zrnitostí jako v předloze.
// Aby se plochy na zemi nepraly s terénem, posune vrchol nepatrně ke kameře (podél paprsku pohledu).
shader_type spatial;
render_mode cull_back;

uniform float posun = 0.0015;      // podíl vzdálenosti od kamery
uniform float posun_m = 0.05;      // stálý posun ke kameře (m): zakryje drobné výstupky terénu mezi body silnice
uniform float drsnost = 0.9;
global uniform float mokro;    // mokrá vozovka po dešti 0–1
global uniform float snih;     // sněhová pokrývka 0–1

varying vec3 svet;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vnoise(vec2 p) {
	vec2 c = floor(p);
	vec2 u = fract(p);
	vec2 f = u * u * (3.0 - 2.0 * u);
	return mix(mix(hash21(c), hash21(c + vec2(1, 0)), f.x), mix(hash21(c + vec2(0, 1)), hash21(c + vec2(1, 1)), f.x), f.y);
}

void vertex() {
	svet = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec4 pohled = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	pohled.xyz *= 1.0 - posun - posun_m / max(1.0, length(pohled.xyz));
	POSITION = PROJECTION_MATRIX * pohled;
}

void fragment() {
	vec2 xz = svet.xz;
	float px = max(fwidth(xz.x), fwidth(xz.y));
	float fine = (vnoise(xz * 2.6) - 0.5) * (1.0 - smoothstep(0.15, 0.7, px));
	float mid = (vnoise(xz * 0.33) - 0.5) * (1.0 - smoothstep(1.2, 5.0, px));
	float big = vnoise(xz * 0.021) - 0.5;
	vec3 c = COLOR.rgb * (fine * 0.13 + mid * 0.10 + big * 0.07 + 1.0);
	// mokrý asfalt ztmavne a zlesklí; ujetý sníh pokryje vozovku jen zčásti
	c *= 1.0 - 0.22 * mokro;
	c = mix(c, vec3(0.74, 0.78, 0.82), snih * (0.35 + 0.3 * smoothstep(0.4, 0.7, vnoise(xz * 0.7))));
	ALBEDO = c;
	ROUGHNESS = mix(drsnost, 0.34, mokro * (1.0 - snih));
	SPECULAR = 0.3 + 0.2 * mokro;
}
