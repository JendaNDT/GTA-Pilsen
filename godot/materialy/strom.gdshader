// Stromy: barva z vrcholu a instance, roční období a sníh (vegetation.js, tree-models.js).
// Alfa barvy vrcholu odlišuje listí (1) od kmene (0). Listnaté koruny se tónují podle období
// (jaro světlejší, podzim do oranžova) a v zimě z nich zbudou jen řídké holé větve.
shader_type spatial;
render_mode cull_back;

global uniform vec4 obdobi;    // rgb = tón listí, a = 1 v zimě (bez listí)
global uniform float snih;     // sněhová pokrývka 0–1
uniform bool listnaty = true;

varying float listi;
varying vec3 mistni;
varying float nahoru;

float hash31(vec3 p) {
	p = fract(p * vec3(0.1031, 0.1030, 0.0973));
	p += dot(p, p.yxz + 33.33);
	return fract((p.x + p.y) * p.z);
}

void vertex() {
	listi = COLOR.a;
	mistni = VERTEX;
	nahoru = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y;
}

void fragment() {
	vec3 c = COLOR.rgb;
	if (listnaty && listi > 0.5) {
		if (obdobi.a > 0.5) {
			// holé větve: řídká šedohnědá koruna
			if (hash31(floor(mistni * 3.0)) > 0.32) {
				discard;
			}
			c = vec3(0.24, 0.2, 0.17) * (0.8 + 0.4 * hash31(floor(mistni * 7.0)));
		} else {
			c *= obdobi.rgb;
		}
	}
	if (snih > 0.0) {
		c = mix(c, vec3(0.79, 0.85, 0.9), smoothstep(0.2, 0.9, nahoru) * snih * (listi > 0.5 ? 0.85 : 0.3));
	}
	ALBEDO = c;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
}
