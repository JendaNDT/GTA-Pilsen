// Fasády budov – rub (druhý průchod materiálu budov). Stejný vzhled jako líc, jen se kreslí
// odvrácené plochy a vrchol se posune nepatrně dál od kamery: v rovině, kde je líc i rub,
// vyhraje líc (obdoba polygonOffset). Kde je jen rub, je vidět on.
shader_type spatial;
render_mode cull_front;

#include "res://materialy/budova.gdshaderinc"

void vertex() {
	okno = vec3(UV, UV2.x);
	nahoru = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y;
	vec4 pohled = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	pohled.xyz *= 1.0 + 0.0006 + 0.02 / max(1.0, length(pohled.xyz));
	POSITION = PROJECTION_MATRIX * pohled;
}
