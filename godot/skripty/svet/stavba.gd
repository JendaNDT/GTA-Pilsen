class_name Stavba
extends RefCounted
## Stavba geometrie dlaždice z převedených dat. Postupy odpovídají původní hře
## (src/world/chunks.js: buildTerrain, ribbon, dashes, buildBuildings). Funkce jen počítají pole
## čísel, takže mohou běžet i mimo hlavní vlákno. Uzly a zdroje vytváří Svet.
##
## Pozor na pořadí vrcholů: Godot bere jako přední stěnu trojúhelník po směru hodinových ručiček,
## three.js proti směru. Proto jsou trojice vrcholů oproti předloze prohozené.

const SURF := 0.05          ## o kolik nad terénem leží jízdní povrch (World.SURF)


## Pomocná třída pro skládání jedné plochy sítě.
class Plocha:
	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var c := PackedColorArray()
	var uv := PackedVector2Array()
	var uv2 := PackedVector2Array()
	var i := PackedInt32Array()
	var s_uv := false

	func pocet() -> int:
		return v.size()

	func pole() -> Array:
		var a := []
		a.resize(Mesh.ARRAY_MAX)
		a[Mesh.ARRAY_VERTEX] = v
		a[Mesh.ARRAY_NORMAL] = n
		a[Mesh.ARRAY_COLOR] = c
		if s_uv:
			a[Mesh.ARRAY_TEX_UV] = uv
			a[Mesh.ARRAY_TEX_UV2] = uv2
		if not i.is_empty():
			a[Mesh.ARRAY_INDEX] = i
		return a


# ------------------------------------------------------------------ terén

## Síť terénu dlaždice ve světových souřadnicích.
static func teren(t: Mapa.Teren) -> Dictionary:
	var n := t.n
	var N := n - 1
	var g := t.g
	var h := t.h
	var p := Plocha.new()
	p.s_uv = true
	p.v.resize(n * n)
	p.n.resize(n * n)
	p.uv.resize(n * n)
	p.c.resize(n * n)
	p.uv2.resize(n * n)
	var bila := Color(1, 1, 1)
	var k := 0
	for j in n:
		for i in n:
			var x := t.x0 + i * g
			var z := t.z0 + j * g
			p.v[k] = Vector3(x, h[k], z)
			var hx: float
			var hz: float
			if i > 0 and i < N:
				hx = (h[k + 1] - h[k - 1]) / (2.0 * g)
			else:
				hx = (Mapa.vyska(x + g, z) - Mapa.vyska(x - g, z)) / (2.0 * g)
			if j > 0 and j < N:
				hz = (h[k + n] - h[k - n]) / (2.0 * g)
			else:
				hz = (Mapa.vyska(x, z + g) - Mapa.vyska(x, z - g)) / (2.0 * g)
			p.n[k] = Vector3(-hx, 1.0, -hz).normalized()
			p.uv[k] = Vector2(float(i) / N, float(j) / N)
			p.c[k] = bila
			k += 1
	if not t.indexy.is_empty():
		p.i = t.indexy.duplicate()
		for q in range(0, p.i.size(), 3):
			var a := p.i[q + 1]
			p.i[q + 1] = p.i[q + 2]
			p.i[q + 2] = a
	else:
		p.i.resize(N * N * 6)
		var q := 0
		for j in N:
			for i in N:
				var v00 := j * n + i
				var v10 := v00 + 1
				var v01 := v00 + n
				var v11 := v01 + 1
				# úhlopříčka 10–01 jako v Mapa.vyska()
				p.i[q] = v00; p.i[q + 1] = v10; p.i[q + 2] = v01
				p.i[q + 3] = v10; p.i[q + 4] = v11; p.i[q + 5] = v01
				q += 6
	return {"teren": p, "kolize": _kolize_se_dnem(t) if not t.hl.is_empty() else trojuhelniky(p)}


## Kolize terénu s říčním dnem pod hladinou (terrainTriangles v předloze): mřížka 4 m,
## výška = viditelný terén − hloubka vody. Hladina zůstává jen viditelná.
static func _kolize_se_dnem(t: Mapa.Teren) -> PackedVector3Array:
	var body := PackedVector3Array()
	body.resize(65 * 65)
	for j in 65:
		for i in 65:
			var x := t.x0 + i * 4.0
			var z := t.z0 + j * 4.0
			body[j * 65 + i] = Vector3(x, Mapa.vyska(x, z) - t.hl[j * 65 + i] * 0.01, z)
	var out := PackedVector3Array()
	out.resize(64 * 64 * 6)
	var q := 0
	for j in 64:
		for i in 64:
			var v00 := j * 65 + i
			out[q] = body[v00]; out[q + 1] = body[v00 + 1]; out[q + 2] = body[v00 + 65]
			out[q + 3] = body[v00 + 1]; out[q + 4] = body[v00 + 66]; out[q + 5] = body[v00 + 65]
			q += 6
	return out


## Seznam vrcholů trojúhelníků pro ConcavePolygonShape3D.
static func trojuhelniky(p: Plocha) -> PackedVector3Array:
	var out := PackedVector3Array()
	if p.i.is_empty():
		return p.v.duplicate()
	out.resize(p.i.size())
	for q in p.i.size():
		out[q] = p.v[p.i[q]]
	return out


## Povrch země (paleta barev, 1 m na pixel) jako obrázek R8.
static func povrch(blok: Variant) -> Image:
	if blok == null:
		return null
	var s: int = blok.s
	return Image.create_from_data(s, s, false, Image.FORMAT_R8, blok.px)


# ------------------------------------------------------------------ silnice

class Cesta:
	var x: PackedFloat32Array
	var z: PackedFloat32Array
	var y: PackedFloat32Array
	var zac := 0
	var n := 0
	var s_y := false
	var px := NAN
	var pz := NAN
	var nx := NAN
	var nz := NAN


static func _nan(v: float) -> float:
	return NAN if v > 1e29 else v


## Kolmice k čáře v bodě k (průměr sousedních úseků) a měřítko pro ostré lomy.
## Vrací Vector4(nx, nz, scale, dot). Odpovídá pathNormal v src/world/road-profile.js.
static func kolmice(d: Cesta, k: int) -> Vector4:
	var o := d.zac
	var X := d.x
	var Z := d.z
	var ax := X[o + k - 1] if k > 0 else d.px
	var az := Z[o + k - 1] if k > 0 else d.pz
	var bx := X[o + k + 1] if k < d.n - 1 else d.nx
	var bz := Z[o + k + 1] if k < d.n - 1 else d.nz
	var d0x := 0.0
	var d0z := 0.0
	var d1x := 0.0
	var d1z := 0.0
	var has0 := not is_nan(ax)
	var has1 := not is_nan(bx)
	if has0:
		d0x = X[o + k] - ax
		d0z = Z[o + k] - az
		var l := sqrt(d0x * d0x + d0z * d0z)
		if l == 0.0:
			l = 1.0
		d0x /= l
		d0z /= l
	if has1:
		d1x = bx - X[o + k]
		d1z = bz - Z[o + k]
		var l := sqrt(d1x * d1x + d1z * d1z)
		if l == 0.0:
			l = 1.0
		d1x /= l
		d1z /= l
	var nx: float
	var nz: float
	var scale := 1.0
	var dot := 1.0
	if has0 and has1:
		nx = -(d0z + d1z)
		nz = d0x + d1x
		var l := sqrt(nx * nx + nz * nz)
		if l < 1e-4:
			nx = -d1z
			nz = d1x
		else:
			nx /= l
			nz /= l
		dot = nx * -d1z + nz * d1x
		scale = 1.0 / maxf(0.55, dot)
	elif has1:
		nx = -d1z
		nz = d1x
	else:
		nx = -d0z
		nz = d0x
	return Vector4(nx, nz, scale, dot)


static func _vrchol(p: Plocha, x: float, y: float, z: float, col: Color) -> int:
	p.v.append(Vector3(x, y, z))
	p.n.append(Vector3.UP)
	p.c.append(col)
	return p.v.size() - 1


static func _ctyruhelnik(p: Plocha, a: int, b: int, c: int, d: int) -> void:
	# předloha: (a, b, c), (a, c, d)
	p.i.append_array([a, c, b, a, d, c])


static func _y(d: Cesta, k: int, x: float, z: float, lift: float) -> float:
	if d.s_y:
		return d.y[d.zac + k] + lift
	return Mapa.vyska(x, z) + SURF + lift


static func _kruh(p: Plocha, d: Cesta, k: int, x: float, z: float, r: float, col: Color, lift: float) -> void:
	var c0 := _vrchol(p, x, _y(d, k, x, z, lift), z, col)
	var prvni := -1
	var pred := -1
	for s in 8:
		var a := s / 8.0 * TAU
		var vx := x + cos(a) * r
		var vz := z + sin(a) * r
		var v := _vrchol(p, vx, _y(d, k, vx, vz, lift), vz, col)
		if s == 0:
			prvni = v
		else:
			p.i.append_array([c0, pred, v])
		pred = v
	p.i.append_array([c0, pred, prvni])


## Pás položený na terén nebo na mostovku (ribbon v chunks.js).
static func pas(p: Plocha, d: Cesta, hw: float, col: Color, lateral: float, lift: float,
		cap_zac: bool, cap_kon: bool, stred: bool) -> void:
	var pL := -1
	var pC := -1
	var pR := -1
	var X := d.x
	var Z := d.z
	for k in d.n:
		var nr := kolmice(d, k)
		var nx := nr.x
		var nz := nr.y
		var sc := nr.z
		var bx := X[d.zac + k]
		var bz := Z[d.zac + k]
		if nr.w < 0.93:
			_kruh(p, d, k, bx + nx * lateral, bz + nz * lateral, hw, col, lift)
		var cx := bx + nx * lateral * sc
		var cz := bz + nz * lateral * sc
		var lx := cx - nx * hw * sc
		var lz := cz - nz * hw * sc
		var rx := cx + nx * hw * sc
		var rz := cz + nz * hw * sc
		var L := _vrchol(p, lx, _y(d, k, lx, lz, lift), lz, col)
		var R := _vrchol(p, rx, _y(d, k, rx, rz, lift), rz, col)
		var C := -1
		if stred:
			C = _vrchol(p, cx, _y(d, k, cx, cz, lift), cz, col)
		if pL >= 0:
			if stred:
				_ctyruhelnik(p, pL, pC, C, L)
				_ctyruhelnik(p, pC, pR, R, C)
			else:
				_ctyruhelnik(p, pL, pR, R, L)
		pL = L
		pC = C
		pR = R
		if (k == 0 and cap_zac) or (k == d.n - 1 and cap_kon):
			_kruh(p, d, k, cx, cz, hw, col, lift)


## Přerušovaná čára (dashes v chunks.js).
static func carkovani(p: Plocha, d: Cesta, hw: float, col: Color, dash: float, gap: float,
		lateral: float, lift: float) -> void:
	var acc := 0.0
	var period := dash + gap
	var X := d.x
	var Z := d.z
	for k in d.n - 1:
		var x1 := X[d.zac + k]
		var z1 := Z[d.zac + k]
		var dx := X[d.zac + k + 1] - x1
		var dz := Z[d.zac + k + 1] - z1
		var delka := sqrt(dx * dx + dz * dz)
		if delka < 1e-4:
			continue
		dx /= delka
		dz /= delka
		var nx := -dz
		var nz := dx
		var s := -acc
		while s < delka:
			var s0 := maxf(0.0, s)
			var s1 := minf(delka, s + dash)
			if s1 - s0 > 0.3:
				var ax := x1 + dx * s0 + nx * lateral
				var az := z1 + dz * s0 + nz * lateral
				var bx := x1 + dx * s1 + nx * lateral
				var bz := z1 + dz * s1 + nz * lateral
				var ya: float
				var yb: float
				if d.s_y:
					var y0 := d.y[d.zac + k]
					var y1 := d.y[d.zac + k + 1]
					ya = y0 + (y1 - y0) * (s0 / delka) + lift
					yb = y0 + (y1 - y0) * (s1 / delka) + lift
				else:
					ya = Mapa.vyska(ax, az) + SURF + lift
					yb = Mapa.vyska(bx, bz) + SURF + lift
				var a := _vrchol(p, ax - nx * hw, ya, az - nz * hw, col)
				var b := _vrchol(p, ax + nx * hw, ya, az + nz * hw, col)
				var c := _vrchol(p, bx + nx * hw, yb, bz + nz * hw, col)
				var e := _vrchol(p, bx - nx * hw, yb, bz - nz * hw, col)
				_ctyruhelnik(p, a, b, c, e)
			s += period
		acc = fmod(acc + delka, period)


## Silnice, značení a mosty jedné dlaždice.
## Vrací plochy "asfalt", "znacky", "pevne" a kolizní trojúhelníky mostovek a konstrukcí.
static func silnice(blok: Variant) -> Dictionary:
	var asfalt := Plocha.new()
	var znacky := Plocha.new()
	var kolize := PackedVector3Array()
	if blok == null:
		return {}
	if blok.has("rib"):
		var X: PackedFloat32Array = blok.x
		var Z: PackedFloat32Array = blok.z
		var Y: PackedFloat32Array = blok.y
		var rib: PackedFloat32Array = blok.rib
		for q in range(0, rib.size(), 16):
			var d := Cesta.new()
			d.x = X
			d.z = Z
			d.y = Y
			var flags := int(rib[q + 7])
			d.s_y = (flags & 8) != 0
			d.px = _nan(rib[q + 8])
			d.pz = _nan(rib[q + 9])
			d.nx = _nan(rib[q + 10])
			d.nz = _nan(rib[q + 11])
			d.zac = int(rib[q + 12])
			d.n = int(rib[q + 13])
			var cil := znacky if rib[q] > 0.5 else asfalt
			var od := cil.pocet()
			var od_i := cil.i.size()
			pas(cil, d, rib[q + 1], Color(rib[q + 2], rib[q + 3], rib[q + 4]), rib[q + 5], rib[q + 6],
				(flags & 1) != 0, (flags & 2) != 0, (flags & 4) != 0)
			# povrch na mostě je pro fyziku pevný (na terénu jezdí auto po terénu)
			if d.s_y and cil == asfalt:
				for t in range(od_i, cil.i.size()):
					kolize.append(cil.v[cil.i[t]])
			if od == cil.pocet():
				pass
		var dash: PackedFloat32Array = blok.dash
		for q in range(0, dash.size(), 16):
			var d := Cesta.new()
			d.x = X
			d.z = Z
			d.y = Y
			d.s_y = dash[q + 9] > 0.5
			d.zac = int(dash[q + 10])
			d.n = int(dash[q + 11])
			var cil := znacky if dash[q] > 0.5 else asfalt
			carkovani(cil, d, dash[q + 1], Color(dash[q + 2], dash[q + 3], dash[q + 4]), dash[q + 5], dash[q + 6],
				dash[q + 7], dash[q + 8])
	# přímo kreslené značky (stopčáry, přechody, okružní křižovatka)
	if blok.has("mp"):
		_pripoj(znacky, blok.mp, blok.mc, blok.mi)
	if blok.has("ap"):
		_pripoj(asfalt, blok.ap, blok.ac, blok.ai)
	var pevne := Plocha.new()
	if blok.has("sp"):
		pevne.v = blok.sp
		pevne.c = blok.sc
		pevne.n = ploche_normaly(pevne.v)
		kolize.append_array(pevne.v)
	return {"asfalt": asfalt, "znacky": znacky, "pevne": pevne, "kolize": kolize}


static func _pripoj(p: Plocha, v: PackedVector3Array, c: PackedColorArray, idx: PackedInt32Array) -> void:
	var od := p.v.size()
	p.v.append_array(v)
	p.c.append_array(c)
	var nahoru := PackedVector3Array()
	nahoru.resize(v.size())
	nahoru.fill(Vector3.UP)
	p.n.append_array(nahoru)
	if od == 0:
		p.i.append_array(idx)
	else:
		for q in idx:
			p.i.append(q + od)


## Normály po trojúhelnících pro neindexovanou síť.
static func ploche_normaly(v: PackedVector3Array) -> PackedVector3Array:
	var n := PackedVector3Array()
	n.resize(v.size())
	for q in range(0, v.size() - 2, 3):
		# Godot: přední stěna po směru hodinových ručiček => normála (c - a) × (b - a)
		var nn := (v[q + 2] - v[q]).cross(v[q + 1] - v[q])
		var l := nn.length()
		nn = nn / l if l > 1e-9 else Vector3.UP
		n[q] = nn
		n[q + 1] = nn
		n[q + 2] = nn
	return n


# ------------------------------------------------------------------ budovy

const STRECHA_ROVNA := 0
const STRECHA_SEDLOVA := 1
const STRECHA_HREBEN := 2
const STRECHA_ODSAZENA := 3
const BF_PYRAMID := 32


class StavBudovy:
	var p: Plocha
	var col := Color()
	var k := 1.0


static func _v_budovy(p: Plocha, x: float, y: float, z: float, nrm: Vector3, col: Color, k: float,
		wu: float, wv: float, ws: float) -> int:
	p.v.append(Vector3(x, y, z))
	p.n.append(nrm)
	p.c.append(Color(minf(1.0, col.r * k), minf(1.0, col.g * k), minf(1.0, col.b * k)))
	p.uv.append(Vector2(wu, wv))
	p.uv2.append(Vector2(ws, 0.0))
	return p.v.size() - 1


## Trojúhelník s orientací podle očekávané normály (face v chunks.js).
static func _plocha_budovy(p: Plocha, a: Vector3, b: Vector3, c: Vector3, ocek: Vector3, col: Color, k: float) -> void:
	var nn := (b - a).cross(c - a)
	var l := nn.length()
	nn = nn / l if l > 0.0 else Vector3.UP
	var flip := nn.dot(ocek) < 0.0
	if flip:
		nn = -nn
	var ia := _v_budovy(p, a.x, a.y, a.z, nn, col, k, 0, 0, 0)
	var ib := _v_budovy(p, b.x, b.y, b.z, nn, col, k, 0, 0, 0)
	var ic := _v_budovy(p, c.x, c.y, c.z, nn, col, k, 0, 0, 0)
	if flip:
		p.i.append_array([ia, ib, ic])
	else:
		p.i.append_array([ia, ic, ib])


## Budovy jedné dlaždice (buildBuildings v chunks.js). preskocit = čísla budov nahrazených zaměřením.
static func budovy(blok: Variant, preskocit_nahrazene := false) -> Dictionary:
	var p := Plocha.new()
	p.s_uv = true
	if blok == null:
		return {}
	var B: PackedFloat32Array = blok.b
	var BI: PackedInt32Array = blok.bi
	var X: PackedFloat32Array = blok.x
	var Z: PackedFloat32Array = blok.z
	var OFF: PackedByteArray = blok.off
	var EX: PackedFloat32Array = blok.ex
	var TR: PackedInt32Array = blok.t
	var qi := 0
	var nb := 0
	while qi < BI.size():
		var kruhu := BI[qi]
		var v_zac := BI[qi + 1]
		var styl0 := BI[qi + 2]
		var flags := BI[qi + 4]
		var strecha := BI[qi + 5]
		var ex_zac := BI[qi + 6]
		var tr_zac := BI[qi + 7]
		var tr_poc := BI[qi + 8]
		var nahrazena := BI[qi + 10] == 1
		var velikosti := BI.slice(qi + 11, qi + 11 + kruhu)
		qi += 11 + kruhu
		var o := nb * 12
		nb += 1
		if nahrazena and preskocit_nahrazene:
			continue
		var base := B[o]
		var wall_top := B[o + 1]
		var top := B[o + 2]
		var ground := B[o + 3]
		var zed := Color(B[o + 4], B[o + 5], B[o + 6])
		var krov := Color(B[o + 7], B[o + 8], B[o + 9])
		var floor_h := B[o + 10]
		var bay := B[o + 11]
		var floors := maxi(1, roundi((wall_top - ground) / floor_h))
		var v_base := ((base - ground) / maxf(0.5, wall_top - ground)) * floors
		# zdi
		var v0 := v_zac
		for velikost in velikosti:
			var v1 := v0 + velikost
			var j := v1 - 1
			for v in range(v0, v1):
				var x1 := X[j]
				var z1 := Z[j]
				var x2 := X[v]
				var z2 := Z[v]
				var dx := x2 - x1
				var dz := z2 - z1
				var delka := sqrt(dx * dx + dz * dz)
				if delka < 0.05:
					j = v
					continue
				var nrm := Vector3(dz / delka, 0.0, -dx / delka)
				var styl := styl0
				var oken := 0
				var off := 0
				if styl and delka >= 1.8 and wall_top - ground > 2.2:
					oken = maxi(1, roundi(delka / bay))
					off = OFF[v] * 4
					styl += 8 * mini(floors, 60)
				else:
					styl = 0
				var a := _v_budovy(p, x1, base, z1, nrm, zed, 0.78, off, v_base, styl)
				var b := _v_budovy(p, x2, base, z2, nrm, zed, 0.78, off + oken, v_base, styl)
				var c := _v_budovy(p, x2, wall_top, z2, nrm, zed, 1.0, off + oken, floors, styl)
				var d := _v_budovy(p, x1, wall_top, z1, nrm, zed, 1.0, off, floors, styl)
				# předloha: (a, c, b), (a, d, c)
				p.i.append_array([a, b, c, a, c, d])
				j = v
			v0 = v1
		var s := v_zac
		var n: int = velikosti[0]
		match strecha:
			STRECHA_SEDLOVA:
				var o2 := 0 if Vector2(X[s + 1] - X[s], Z[s + 1] - Z[s]).length() >= Vector2(X[s + 2] - X[s + 1], Z[s + 2] - Z[s + 1]).length() else 1
				var A := s + o2
				var Bq := s + (o2 + 1) % 4
				var Cq := s + (o2 + 2) % 4
				var D := s + (o2 + 3) % 4
				var y := wall_top
				var m1 := Vector3((X[Bq] + X[Cq]) / 2, top, (Z[Bq] + Z[Cq]) / 2)
				var m2 := Vector3((X[D] + X[A]) / 2, top, (Z[D] + Z[A]) / 2)
				var pa := Vector3(X[A], y, Z[A])
				var pb := Vector3(X[Bq], y, Z[Bq])
				var pc := Vector3(X[Cq], y, Z[Cq])
				var pd := Vector3(X[D], y, Z[D])
				_plocha_budovy(p, pa, pb, m1, Vector3.UP, krov, 1.0)
				_plocha_budovy(p, pa, m1, m2, Vector3.UP, krov, 1.0)
				_plocha_budovy(p, pc, pd, m2, Vector3.UP, krov, 0.86)
				_plocha_budovy(p, pc, m2, m1, Vector3.UP, krov, 0.86)
				var cx := (X[s] + X[s + 1] + X[s + 2] + X[s + 3]) / 4
				var cz := (Z[s] + Z[s + 1] + Z[s + 2] + Z[s + 3]) / 4
				_plocha_budovy(p, pb, pc, m1, Vector3(m1.x - cx, 0, m1.z - cz), zed, 1.0)
				_plocha_budovy(p, pd, pa, m2, Vector3(m2.x - cx, 0, m2.z - cz), zed, 1.0)
			STRECHA_HREBEN:
				var ux := EX[ex_zac]
				var uz := EX[ex_zac + 1]
				var uc := EX[ex_zac + 2]
				var wc := EX[ex_zac + 3]
				var half := EX[ex_zac + 4]
				var y := wall_top
				for a in n:
					var b := (a + 1) % n
					var ax := X[s + a]
					var az := Z[s + a]
					var bx := X[s + b]
					var bz := Z[s + b]
					var ua := clampf(ax * ux + az * uz, uc - half, uc + half)
					var ub := clampf(bx * ux + bz * uz, uc - half, uc + half)
					var ra := Vector3(ua * ux - wc * uz, top, ua * uz + wc * ux)
					var rb := Vector3(ub * ux - wc * uz, top, ub * uz + wc * ux)
					var ex := bz - az
					var ez := -(bx - ax)
					var el := sqrt(ex * ex + ez * ez)
					if el == 0.0:
						el = 1.0
					var kk := 0.86 + 0.14 * maxf(0.0, (ex / el) * 0.6 + (ez / el) * 0.4)
					var ocek := Vector3(ex / el * 0.3, 1.0, ez / el * 0.3)
					_plocha_budovy(p, Vector3(ax, y, az), Vector3(bx, y, bz), rb, ocek, krov, kk)
					if ra.distance_to(rb) > 0.05:
						_plocha_budovy(p, Vector3(ax, y, az), rb, ra, ocek, krov, kk)
			STRECHA_ODSAZENA:
				var y := wall_top
				for a in n:
					var b := (a + 1) % n
					var ax := X[s + a]
					var az := Z[s + a]
					var bx := X[s + b]
					var bz := Z[s + b]
					var ex := bz - az
					var ez := -(bx - ax)
					var el := sqrt(ex * ex + ez * ez)
					if el == 0.0:
						el = 1.0
					var ocek := Vector3(ex / el * 0.4, 1.0, ez / el * 0.4)
					var ib := Vector3(EX[ex_zac + b * 2], top, EX[ex_zac + b * 2 + 1])
					var ia := Vector3(EX[ex_zac + a * 2], top, EX[ex_zac + a * 2 + 1])
					_plocha_budovy(p, Vector3(ax, y, az), Vector3(bx, y, bz), ib, ocek, krov, 1.0)
					_plocha_budovy(p, Vector3(ax, y, az), ib, ia, ocek, krov, 1.0)
				var i0 := p.v.size()
				for a in n:
					_v_budovy(p, EX[ex_zac + a * 2], top, EX[ex_zac + a * 2 + 1], Vector3.UP, krov, 0.9, 0, 0, 0)
				for q in range(tr_zac, tr_zac + tr_poc, 3):
					p.i.append_array([i0 + TR[q], i0 + TR[q + 2], i0 + TR[q + 1]])
			_:
				var i0 := p.v.size()
				var celkem := 0
				for velikost in velikosti:
					celkem += velikost
				for v in range(v_zac, v_zac + celkem):
					_v_budovy(p, X[v], top, Z[v], Vector3.UP, krov, 1.0, 0, 0, 0)
				for q in range(tr_zac, tr_zac + tr_poc, 3):
					p.i.append_array([i0 + TR[q], i0 + TR[q + 2], i0 + TR[q + 1]])
	return {"budovy": p, "kolize": trojuhelniky(p)}


# ------------------------------------------------------------------ stromy a lampy

## Polohy stromů: pole Transform3D a barev pro dva druhy (0 listnatý, 1 jehličnatý).
static func stromy(blok: Variant, roh: Vector2) -> Array:
	var out := [[], []]
	if blok == null:
		return out
	var pos: PackedByteArray = blok.p
	var a: PackedByteArray = blok.a
	var pocet := a.size() / 4
	for k in pocet:
		var x := roh.x + pos.decode_u16(k * 4) * 0.01
		var z := roh.y + pos.decode_u16(k * 4 + 2) * 0.01
		var s := a[k * 4] * 0.01
		var protazeni := a[k * 4 + 1] * 0.01
		var r := a[k * 4 + 2] / 255.0
		var druh := a[k * 4 + 3]
		var b := Basis(Vector3.UP, r * TAU).scaled(Vector3(s, s * protazeni, s))
		var t := Transform3D(b, Vector3(x, Mapa.vyska(x, z), z))
		var g := 0.82 + r * 0.36
		out[druh].append([t, Color(g * (0.9 + r * 0.25), g, g * 0.85)])
	return out


# ------------------------------------------------------------------ městský model a konstrukce

## Zaměřené budovy centra: hlavní síť (s okny jako budovy) a detail (římsy, věže…).
static func mesto(blok: Variant) -> Dictionary:
	if blok == null:
		return {}
	var out := {}
	var kolize := PackedVector3Array()
	for prefix: String in ["", "d"]:
		if not blok.has(prefix + "p"):
			continue
		var p := Plocha.new()
		p.v = blok[prefix + "p"]
		p.n = blok[prefix + "n"]
		p.c = blok[prefix + "c"]
		p.i = blok[prefix + "i"]
		if prefix == "" and blok.has("win"):
			var w: PackedFloat32Array = blok.win
			p.s_uv = true
			var n := p.v.size()
			p.uv.resize(n)
			p.uv2.resize(n)
			for k in n:
				p.uv[k] = Vector2(w[k * 3], w[k * 3 + 1])
				p.uv2[k] = Vector2(w[k * 3 + 2], 0.0)
		out["hlavni" if prefix == "" else "detail"] = p
		if prefix == "":
			kolize = trojuhelniky(p)
	out["kolize"] = kolize
	return out


## Zaměřené konstrukce (zdi, pilíře, jezy): betonová barva, ploché normály.
static func konstrukce(blok: Variant) -> Dictionary:
	if blok == null:
		return {}
	var p := Plocha.new()
	p.v = blok.p
	p.n = ploche_normaly(p.v)
	p.c.resize(p.v.size())
	p.c.fill(Color.hex(0x938c82ff).srgb_to_linear())
	return {"konstrukce": p, "kolize": p.v}
