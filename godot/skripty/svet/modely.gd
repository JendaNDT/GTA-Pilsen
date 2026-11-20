class_name Modely
extends RefCounted
## Jednoduché modely skládané z kódu (stromy, lampy). Tvary odpovídají src/world/chunks.js.


static func _lin(hex: int) -> Color:
	return Color.hex(hex << 8 | 0xff).srgb_to_linear()


## Přidá trojúhelník v pořadí three.js (proti směru hodinových ručiček) – zde se obrací pro Godot.
static func _troj(p: Stavba.Plocha, a: Vector3, b: Vector3, c: Vector3, col: Color, nrm := Vector3.ZERO) -> void:
	var n := nrm if nrm != Vector3.ZERO else (b - a).cross(c - a).normalized()
	p.v.append_array([a, c, b])
	p.n.append_array([n, n, n])
	p.c.append_array([col, col, col])


static func _dvacetisten(r: float) -> Array:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var body := [Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0),
		Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t),
		Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1)]
	var idx := [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6,
		7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1]
	var out := []
	for k in idx.size():
		out.append((body[idx[k]] as Vector3).normalized() * r)
	return out


static func _kuzel(r: float, h: float, segmentu: int) -> Array:
	var out := []
	var vrchol := Vector3(0, h / 2.0, 0)
	for s in segmentu:
		var a0 := float(s) / segmentu * TAU
		var a1 := float(s + 1) / segmentu * TAU
		var p0 := Vector3(r * sin(a0), -h / 2.0, r * cos(a0))
		var p1 := Vector3(r * sin(a1), -h / 2.0, r * cos(a1))
		out.append_array([vrchol, p0, p1])
		out.append_array([Vector3(0, -h / 2.0, 0), p1, p0])
	return out


static func _strom(koruny: Array, kmen_h: float, kmen_r: float, kmen_col: Color, koruna_col: Color) -> ArrayMesh:
	var p := Stavba.Plocha.new()
	# kmen: otevřený šestiboký válec
	var y0 := -0.3
	var y1 := kmen_h + 0.3
	var rt := kmen_r * 0.65
	for s in 6:
		var a0 := float(s) / 6.0 * TAU
		var a1 := float(s + 1) / 6.0 * TAU
		var n0 := Vector3(sin(a0), 0, cos(a0))
		var n1 := Vector3(sin(a1), 0, cos(a1))
		var a := n0 * kmen_r + Vector3(0, y0, 0)
		var b := n1 * kmen_r + Vector3(0, y0, 0)
		var c := n1 * rt + Vector3(0, y1, 0)
		var d := n0 * rt + Vector3(0, y1, 0)
		var nn := ((n0 + n1) * 0.5).normalized()
		_troj(p, a, b, c, kmen_col, nn)
		_troj(p, a, c, d, kmen_col, nn)
	var vrcholy: Array = []
	var ymin := 1e9
	var ymax := -1e9
	for k in koruny:
		var tvar: Array = k[0]
		var posun := Vector3(k[1], k[2], k[3])
		var pole := []
		for v: Vector3 in tvar:
			var w := v + posun
			pole.append(w)
			ymin = minf(ymin, w.y)
			ymax = maxf(ymax, w.y)
		vrcholy.append(pole)
	for pole: Array in vrcholy:
		for q in range(0, pole.size(), 3):
			var my: float = (pole[q].y + pole[q + 1].y + pole[q + 2].y) / 3.0
			var stin: float = 0.66 + 0.42 * (my - ymin) / (ymax - ymin) + 0.08 * sin(q * 12.9898)
			_troj(p, pole[q], pole[q + 1], pole[q + 2], koruna_col * stin)
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, p.pole())
	return m


static func strom_listnaty() -> ArrayMesh:
	return _strom([
		[_dvacetisten(2.1), 0.0, 4.6, 0.0],
		[_dvacetisten(1.6), 1.1, 5.6, 0.4],
		[_dvacetisten(1.5), -0.9, 5.2, -0.8],
		[_dvacetisten(1.3), -0.2, 6.4, 0.7],
	], 3.4, 0.24, _lin(0x5b4a3a), _lin(0x5f9146))


static func strom_jehlicnaty() -> ArrayMesh:
	return _strom([
		[_kuzel(1.9, 3.4, 7), 0.0, 3.6, 0.0],
		[_kuzel(1.5, 3.0, 7), 0.0, 5.4, 0.0],
		[_kuzel(1.0, 2.6, 7), 0.0, 7.1, 0.0],
	], 2.4, 0.2, _lin(0x4f4034), _lin(0x3d6c44))


## Kvádr se středem c a rozměry s (přidá do plochy).
static func kvadr(p: Stavba.Plocha, c: Vector3, s: Vector3, col: Color) -> void:
	var h := s * 0.5
	var r := [
		[Vector3(1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1)],
		[Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, -1)],
		[Vector3(0, 1, 0), Vector3(0, 0, 1), Vector3(1, 0, 0)],
		[Vector3(0, -1, 0), Vector3(0, 0, -1), Vector3(1, 0, 0)],
		[Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 1, 0)],
		[Vector3(0, 0, -1), Vector3(-1, 0, 0), Vector3(0, 1, 0)],
	]
	for strana: Array in r:
		var n: Vector3 = strana[0]
		var u: Vector3 = strana[1]
		var w: Vector3 = strana[2]
		var stred := c + n * h
		var du := u * h
		var dw := w * h
		var a := stred - du - dw
		var b := stred + du - dw
		var cc := stred + du + dw
		var d := stred - du + dw
		# three.js pořadí (a, b, c) s normálou n = u × w
		_troj(p, a, b, cc, col, n)
		_troj(p, a, cc, d, col, n)


static func lampa() -> ArrayMesh:
	var p := Stavba.Plocha.new()
	kvadr(p, Vector3(0, 7.0 / 2.0 - 0.25, 0), Vector3(0.16, 7.5, 0.16), _lin(0x3a3f45))
	kvadr(p, Vector3(0, 7.07, 0), Vector3(0.5, 0.14, 0.5), Color(1.0, 0.85, 0.6))
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, p.pole())
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.6
	mat.metallic = 0.4
	m.surface_set_material(0, mat)
	return m
