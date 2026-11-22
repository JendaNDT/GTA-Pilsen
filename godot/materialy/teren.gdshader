// Terén: barva podle mapy povrchů (číslo barvy z palety, 1 m na pixel) a voda.
// Hrany mezi barvami se vyhlazují ručním bilineárním smícháním čtyř sousedních barev.
shader_type spatial;
render_mode cull_back;

uniform sampler2D povrch : filter_nearest, repeat_disable;
uniform sampler2D paleta : filter_nearest, repeat_disable;
uniform float pixelu = 256.0;
// letecký snímek bloku 1 024 m (2 m na pixel); orto_uv = posun a měřítko dlaždice v bloku
uniform sampler2D ortofoto : source_color, filter_linear, repeat_disable;
uniform vec3 orto_uv = vec3(0.0, 0.0, 0.25);
uniform float orto_ma = 0.0;
global uniform float ortofoto_zap;
global uniform float noc;
global uniform float mokro;
global uniform float snih;

varying vec3 svet;
varying vec3 svet_normala;

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

// Číslo barvy z palety; bit 0x80 označuje otevřenou krajinu s leteckým snímkem.
int kod(ivec2 p) {
	int maxp = int(pixelu) - 1;
	return int(texelFetch(povrch, clamp(p, ivec2(0), ivec2(maxp)), 0).r * 255.0 + 0.5);
}

vec4 barva(ivec2 p) {
	int i = kod(p) % 128;
	vec3 c = texelFetch(paleta, ivec2(i, 0), 0).rgb;
	return vec4(c, i == 0 ? 1.0 : 0.0);
}

float krajina(ivec2 p) {
	return kod(p) >= 128 ? 1.0 : 0.0;
}

// Míchání „soft-light“ jako drawGround v předloze (snímek přes barvu povrchu, 80 %).
float mekke(float a, float b) {
	if (b <= 0.5) {
		return a - (1.0 - 2.0 * b) * a * (1.0 - a);
	}
	float d = a <= 0.25 ? ((16.0 * a - 12.0) * a + 4.0) * a : sqrt(a);
	return a + (2.0 * b - 1.0) * (d - a);
}

void vertex() {
	svet = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	svet_normala = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec2 t = UV * pixelu - 0.5;
	ivec2 b = ivec2(floor(t));
	vec2 f = fract(t);
	// Hranice barev (chodník, krajnice, tráva) jako hladká čára místo schodů po 1 m: každá ze čtyř
	// sousedních barev dostane podíl podle bilineárních vah a vyhraje ta s největším podílem; přechod
	// k druhé je jen tak široký, aby se hrana nevykreslila zubatě (vyhlazení podle velikosti pixelu).
	int k00 = kod(b) % 128;
	int k10 = kod(b + ivec2(1, 0)) % 128;
	int k01 = kod(b + ivec2(0, 1)) % 128;
	int k11 = kod(b + ivec2(1, 1)) % 128;
	vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
	ivec4 kody = ivec4(k00, k10, k01, k11);
	vec4 podil = vec4(0.0);
	for (int i = 0; i < 4; i++) {
		for (int j = 0; j < 4; j++) {
			podil[i] += kody[i] == kody[j] ? w[j] : 0.0;
		}
	}
	int prvni = 0;
	for (int i = 1; i < 4; i++) {
		if (podil[i] > podil[prvni]) { prvni = i; }
	}
	int druhy = -1;
	for (int i = 0; i < 4; i++) {
		if (kody[i] != kody[prvni] && (druhy < 0 || podil[i] > podil[druhy])) { druhy = i; }
	}
	vec4 c;
	vec4 ca = barva(b + ivec2(prvni % 2, prvni / 2));
	if (druhy < 0) {
		c = ca;
	} else {
		vec4 cb = barva(b + ivec2(druhy % 2, druhy / 2));
		float rozdil = podil[prvni] - podil[druhy];
		float sirka = max(fwidth(rozdil) * 0.8, 0.16);
		// rozdil je vždy ≥ 0 (vítěz má největší podíl); na hranici je 0 → polovina obou barev
		c = mix(cb, ca, 0.5 + 0.5 * smoothstep(0.0, sirka, rozdil));
	}
	float voda_plocha = smoothstep(0.35, 0.65, c.a);
	// Hladina je jen na rovině; svah břehu v polygonu vody se kreslí jako mokrý břeh.
	float rovina = smoothstep(0.955, 0.99, svet_normala.y);
	float voda = voda_plocha * rovina;
	c.rgb = mix(c.rgb, vec3(0.16, 0.15, 0.11), voda_plocha * (1.0 - rovina));
	// zrnitost povrchu slábne s velikostí pixelu (groundNoise v materials.js)
	vec2 xz = svet.xz;
	float px = max(fwidth(xz.x), fwidth(xz.y));
	float fine = (vnoise(xz * 2.6) - 0.5) * (1.0 - smoothstep(0.15, 0.7, px));
	float mid = (vnoise(xz * 0.33) - 0.5) * (1.0 - smoothstep(1.2, 5.0, px));
	float big = vnoise(xz * 0.021) - 0.5;
	float gain = fine * 0.13 + mid * 0.10 + big * 0.07 + 1.0;
	if (orto_ma * ortofoto_zap > 0.5) {
		float w = mix(mix(krajina(b), krajina(b + ivec2(1, 0)), f.x), mix(krajina(b + ivec2(0, 1)), krajina(b + ivec2(1, 1)), f.x), f.y);
		if (w > 0.0) {
			// barvy povrchu jsou lineární, míchání probíhá v sRGB jako na plátně předlohy
			vec3 s = pow(clamp(c.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
			vec3 o = texture(ortofoto, orto_uv.xy + UV * orto_uv.z).rgb;
			o = pow(o, vec3(1.0 / 2.2));
			vec3 m = vec3(mekke(s.r, o.r), mekke(s.g, o.g), mekke(s.b, o.b));
			c.rgb = mix(c.rgb, pow(m, vec3(2.2)), 0.8 * w);
		}
	}
	vec3 zeme = c.rgb * gain * (1.0 - 0.14 * mokro);
	if (snih > 0.0) {
		zeme = mix(zeme, vec3(0.79, 0.85, 0.9), smoothstep(0.17, 0.88, svet_normala.y) * snih);
	}
	// voda: tmavá hladina s jemným vlněním
	float vlna = vnoise(xz * 0.35 + TIME * vec2(0.12, 0.05)) + vnoise(xz * 1.1 - TIME * vec2(0.05, 0.16)) * 0.5;
	vec3 hladina = vec3(0.035, 0.075, 0.085) * (0.9 + vlna * 0.12);
	ALBEDO = mix(zeme, hladina, voda);
	ROUGHNESS = mix(0.95 * (1.0 - 0.38 * mokro), 0.08, voda);
	SPECULAR = mix(0.25, 0.6, voda);
	if (voda > 0.01) {
		vec3 n = normalize(vec3((vlna - 0.75) * 0.08, 1.0, (vnoise(xz * 0.5 + TIME * 0.1) - 0.5) * 0.08));
		NORMAL = mix(NORMAL, (VIEW_MATRIX * vec4(n, 0.0)).xyz, voda);
	}
}
