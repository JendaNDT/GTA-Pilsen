// Fasády budov: barva zdi z vrcholu, okna kreslená podle stylu (převod src/world/building-nodes.js).
// UV = sloupec a patro okna, UV2.x = kód (styl + 8 × počet pater). Kód 0 = plocha bez oken (střechy).
shader_type spatial;
render_mode cull_back;

global uniform float noc;      // 0 den, 1 noc
global uniform vec4 okna;      // podíl rozsvícených oken: x byty, y kanceláře, z obchody, w = 1 rozvrh platí
global uniform float snih;     // sněhová pokrývka 0–1 (střechy)

varying vec3 okno;
varying float nahoru;

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

float rozsah(float v, float a, float b, float w) {
	return smoothstep(a - w, a + w, v) - smoothstep(b - w, b + w, v);
}

void vertex() {
	okno = vec3(UV, UV2.x);
	nahoru = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y;
}

void fasada(inout vec3 color, inout float svit, inout float sklo, vec2 cell, float code, float style, vec2 width) {
	vec2 uv = fract(cell);
	vec2 id = floor(cell);
	float detail = 1.0 - smoothstep(0.25, 0.8, max(width.x, width.y));
	float ground = step(id.y, 0.5);
	float h1 = hash21(id + 7.0);
	float h2 = hash21(id * 1.7 + 3.1);
	float column = hash21(vec2(id.x, 5.0));
	float plaster = vnoise(cell * vec2(2.3, 1.7)) * detail * 0.10 + 0.95;
	vec3 wall = color * plaster;
	vec3 trim = mix(wall * 1.28, vec3(0.86, 0.85, 0.80), 0.45);
	vec4 rect = vec4(0.30, 0.70, 0.30, 0.75);
	float frame_w = 0.035;
	float vertical = 0.0, horizontal = 0.0, sill = 1.0, door = 0.0, shop = 0.0, loggia = 0.0;
	if (style < 1.5) {
		rect = vec4(0.30, 0.70, 0.30, 0.74);
		vertical = 1.0;
		if (ground > 0.5 && column > 0.72) { rect = vec4(0.36, 0.64, 0.0, 0.72); door = 1.0; sill = 0.0; }
	} else if (style < 2.5) {
		rect = vec4(0.20, 0.80, 0.36, 0.78);
		vertical = 1.0;
		if (column > 0.6 && ground < 0.5) { loggia = 1.0; rect = vec4(0.22, 0.78, 0.44, 0.88); sill = 0.0; }
		float joint = 1.0 - min(smoothstep(0.0, width.x + 0.014, uv.x), smoothstep(0.0, width.y + 0.018, uv.y));
		wall *= 1.0 - joint * 0.14 * detail;
	} else if (style < 3.5) {
		rect = vec4(0.30, 0.70, 0.22, 0.80);
		vertical = 1.0;
		horizontal = 1.0;
		if (ground > 0.5) {
			if (column > 0.8) { rect = vec4(0.32, 0.68, 0.0, 0.76); door = 1.0; }
			else { rect = vec4(0.07, 0.93, 0.10, 0.70); shop = 1.0; vertical = 0.0; horizontal = 0.0; }
			sill = 0.0;
		}
		wall *= (1.0 - smoothstep(0.03, width.y + 0.05, uv.y)) * 0.13 * detail * (1.0 - ground) + 1.0;
		wall *= (1.0 - rozsah(uv.x, 0.05, 0.95, width.x)) * 0.06 * detail + 1.0;
	} else if (style < 4.5) {
		rect = vec4(0.0, 1.0, 0.30, 0.84);
		frame_w = 0.0;
		sill = 0.0;
	} else if (style < 5.5) {
		rect = vec4(0.14, 0.86, 0.60, 0.86);
		sill = 0.0;
	} else if (style > 6.5) {
		rect = vec4(0.25, 0.75, 0.20, 0.78);
		vertical = 1.0;
		horizontal = 1.0;
		if (ground > 0.5) { rect = vec4(0.23, 0.77, 0.05, 0.68); sill = 0.0; }
		float band = rozsah(uv.y, 0.09, 0.15, width.y) + rozsah(uv.y, 0.86, 0.91, width.y) * 0.75;
		float pilaster = rozsah(uv.x, 0.06, 0.13, width.x) + rozsah(uv.x, 0.87, 0.94, width.x);
		wall *= (band * 0.38 + pilaster * 0.26) * detail + 1.0;
		trim = mix(trim, wall * 1.25, 0.68);
	} else {
		rect = vec4(0.40, 0.60, 0.20, 0.80);
		sill = 0.0;
		wall *= 1.0 - (1.0 - rozsah(uv.x, 0.08, 0.92, width.x)) * 0.16 * detail;
	}
	// sokl, římsa pod střechou a zdivo pod terénem
	float low_style = step(style, 3.5);
	wall *= 1.0 - (1.0 - smoothstep(0.14, width.y + 0.17, cell.y)) * 0.26 * low_style;
	float above = step(0.0, cell.y);
	float top_dist = floor(code / 8.0) - cell.y;
	float cornice = (1.0 - smoothstep(0.07, width.y + 0.09, top_dist)) * low_style;
	float cornice_shade = (1.0 - smoothstep(0.09, 0.15, top_dist)) * (1.0 - cornice) * low_style;
	bool arch = style > 5.5 && style < 6.5;
	float y_top = rect.w - (arch ? abs(uv.x - 0.5) * 0.9 : 0.0);
	float win = clamp(rozsah(uv.x, rect.x, rect.y, width.x) * rozsah(uv.y, rect.z, y_top, width.y), 0.0, 1.0) * above;
	float frame = clamp(rozsah(uv.x, rect.x - frame_w, rect.y + frame_w, width.x)
		* rozsah(uv.y, rect.z - frame_w, y_top + frame_w, width.y) - win, 0.0, 1.0) * above * step(0.001, frame_w);
	float sill_mask = rozsah(uv.x, rect.x - 0.06, rect.y + 0.06, width.x)
		* rozsah(uv.y, rect.z - 0.075, rect.z - 0.035, width.y) * sill * above;
	float glass_h = clamp((uv.y - rect.z) / max(y_top - rect.z, 0.05), 0.0, 1.0);
	vec3 glass = mix(vec3(0.06, 0.091, 0.125), vec3(0.24, 0.34, 0.45), h1 * 0.6 + glass_h * 0.4);
	glass = mix(glass, vec3(0.62, 0.60, 0.55), step(0.72, h2) * 0.4 * (1.0 - shop));
	if (style > 3.5 && style < 4.5) {
		float bars = 1.0 - rozsah(fract(uv.x * 3.0), 0.035, 0.965, width.x * 3.0);
		glass = mix(glass, wall * 0.7, bars * detail);
	} else if (style > 4.5 && style < 5.5) {
		float bars = 1.0 - rozsah(fract(uv.x * 5.0), 0.06, 0.94, width.x * 5.0);
		glass = mix(glass, wall * 0.6, bars * detail);
	}
	bool offices = style > 3.5 && style < 5.5;
	float chance = mix(offices ? okna.y : okna.x, okna.z, shop);
	float active = smoothstep(h2 - 0.035, h2 + 0.035, chance) * step(0.001, chance);
	float previous = max(step(1.0 - noc * 0.5, h2) * noc, shop * step(0.35, h1) * noc)
		* mix(1.0, 0.2, step(4.5, style) * step(style, 5.5)) * (1.0 - door);
	float lit = mix(previous, active * (noc * 0.80 + 0.20) * (1.0 - door), okna.w);
	vec3 lit_color = mix(vec3(1.0, 0.78, 0.44), vec3(0.70, 0.82, 1.0), step(0.86, h1)) * (h1 * 0.38 + 0.62) * (glass_h * 0.2 + 0.8);
	glass = mix(glass, lit_color, lit);
	float cross_x = 1.0 - smoothstep(0.008, width.x + 0.012, abs(uv.x - (rect.x + rect.y) * 0.5));
	float cross_y = 1.0 - smoothstep(0.008, width.y + 0.012, abs(uv.y - mix(rect.z, y_top, 0.68)));
	float bars = max(cross_x * vertical, cross_y * horizontal) * detail;
	glass = mix(glass, trim, bars);
	if (door > 0.5) {
		glass = mix(vec3(0.20, 0.13, 0.09), vec3(0.30, 0.20, 0.13), h1) * (glass_h * 0.30 + 0.85);
	}
	float recess = rozsah(uv.x, 0.07, 0.93, width.x) * rozsah(uv.y, 0.05, 0.95, width.y) * loggia * above;
	float rail = rozsah(uv.y, 0.05, 0.40, width.y) * recess;
	vec3 rail_color = mix(wall * 0.80, vec3(0.45, 0.52, 0.58), hash21(vec2(floor(id.x * 0.25), 2.0)) * 0.35 + 0.25);
	float sign = rozsah(uv.x, 0.05, 0.95, width.x) * rozsah(uv.y, 0.75, 0.93, width.y) * shop * step(0.3, h2) * above;
	vec3 hue = cos((vec3(0.0, 0.33, 0.67) + h1) * 6.2831) * 0.19 + 0.25;
	vec3 sign_color = mix(wall * 0.70, hue, 0.62);
	float area = (rect.y - rect.x) * (y_top - rect.z);
	vec3 shade = mix(wall, wall * 0.52, recess * detail);
	shade = mix(shade, rail_color, rail * detail);
	shade = mix(shade, trim, frame * detail);
	shade = mix(shade, trim, sill_mask * detail);
	shade = mix(shade, sign_color, sign * detail);
	shade = mix(shade, glass, mix(area * above, win, detail));
	shade = mix(wall * 0.78, shade, above);
	color = mix(shade, trim, cornice) * (1.0 - cornice_shade * 0.22 * detail);
	svit = lit * above * mix(area, win * (1.0 - bars), detail) * (h1 * 0.45 + 0.55);
	sklo = win * (1.0 - bars) * (1.0 - door) * detail;
}

void fragment() {
	vec3 color = COLOR.rgb;
	float code = floor(okno.z + 0.5);
	float style = mod(code, 8.0);
	float svit = 0.0;
	float sklo = 0.0;
	if (code > 0.0 && style > 0.5) {
		vec2 width = fwidth(okno.xy) * 0.75 + 0.0001;
		fasada(color, svit, sklo, okno.xy, code, style, width);
	}
	// sníh na plochých a mírně šikmých střechách (snowColor ve weather-surfaces.js)
	if (snih > 0.0) {
		color = mix(color, vec3(0.79, 0.85, 0.9), smoothstep(0.17, 0.88, nahoru) * snih);
	}
	ALBEDO = color;
	ROUGHNESS = mix(0.88, 0.12, sklo);
	SPECULAR = mix(0.3, 0.6, sklo);
	EMISSION = vec3(1.0, 0.78, 0.42) * svit * 0.9;
}
