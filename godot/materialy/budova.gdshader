// Fasády budov – líc. UV = sloupec a patro okna, UV2.x = kód (styl + 8 × počet pater),
// kód 0 = plocha bez oken (střechy).
// Budovy se kreslí z obou stran jako v předloze (DoubleSide): měřený model centra má stěny otočené
// lícem dovnitř a zevnitř budovy nesmí být vidět ven. Rub kreslí druhý průchod (budova_rub.gdshader)
// nepatrně dál od kamery, aby dvě plochy v jedné rovině (společné zdi sousedních domů) neblikaly.
shader_type spatial;
render_mode cull_back;

#include "res://materialy/budova.gdshaderinc"

void vertex() {
	okno = vec3(UV, UV2.x);
	nahoru = (MODEL_MATRIX * vec4(NORMAL, 0.0)).y;
}
