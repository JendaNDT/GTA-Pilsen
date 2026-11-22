class_name Smeny
extends Node
## Směny řidiče MHD (src/game/shift.js, shift-plans.js): hráč převezme skutečný spoj z jízdního řádu
## a odřídí ho po zastávkách. Plyn a brzda řídí rychlost po trase (kolej nebo pruh), F otevírá
## a zavírá dveře. Hodnotí se obsloužené zastávky, přesnost, pravidla a plynulost; za 60 bodů
## a obsluhu 80 % zastávek se platí.

## [druh, linka, odkud (kód stanoviště), kam]. Stanoviště rozlišují směr i větve uzlů.
const OKRUHY := [
	["tram", "1", "53408/3", "53167/3"], ["tram", "1", "53167/4", "53408/4"],
	["trolleybus", "16", "53408/1", "53090/1"], ["trolleybus", "16", "53090/2", "53408/2"],
	["bus", "30", "57061/4", "57125/2"], ["bus", "30", "57125/1", "57061/3"],
]
const DRUHY := {"tram": "Tramvaj", "trolleybus": "Trolejbus", "bus": "Autobus"}
const STAVY := {"vyplaceno": "Dokončeno", "bez_odmeny": "Bez odměny", "zruseno": "Zrušeno", "preruseno": "Přerušeno"}
const PREDSTIH := 5.0           ## SHIFT_LEAD: nástup 5 s před odjezdem
const DOSAH_ZASTAVKY := 4.5     ## STOP_RANGE
const STOJI := 0.28             ## STOP_SPEED (m/s)
const LIMIT := 13.9             ## 50 km/h

var hra: Hra
var aktivni := {}               ## probíhající směna
var posledni := {}              ## poslední výsledek


static func nazev(nabidka: Dictionary) -> String:
	return "%s %s · %s → %s" % [DRUHY.get(nabidka.druh, nabidka.druh), nabidka.linka, nabidka.odkud, nabidka.kam]


## Nejbližší odjezd každého okruhu od času ted (shiftOffers v předloze).
static func nabidky(jr: JizdniRad, ted: float) -> Array:
	var out: Array = []
	if jr == null:
		return out
	var dnes := floori(ted / JizdniRad.DEN)
	for o: Array in OKRUHY:
		var zacatek := -1
		var konec := -1
		for i in jr.stanoviste.size():
			if jr.stanoviste[i][3] == o[2]:
				zacatek = i
			if jr.stanoviste[i][3] == o[3]:
				konec = i
		if zacatek < 0 or konec < 0:
			continue
		var vybrana := {}
		for den in range(dnes - jr.max_posun, dnes + 3):
			if not vybrana.is_empty() and vybrana.odjezd < den * JizdniRad.DEN:
				break
			var profil := jr.profil(den)
			for z: Array in jr.zastaveni_na_stanovisti[zacatek]:
				var spoj: Dictionary = z[1]
				var t: JizdniRad.Trasa = spoj.trasa
				if t.typ != o[0] or t.linka != o[1] or not profil.has(z[0]):
					continue
				var prvni: int = z[2]
				var casy: PackedInt32Array = spoj.casy
				var odjezd := float(den * JizdniRad.DEN + JizdniRad.cas(casy[prvni * 2 + 1]))
				if odjezd < ted + PREDSTIH or (not vybrana.is_empty() and odjezd >= vybrana.odjezd):
					continue
				var zast: Array = spoj.zastaveni
				var posledni_i := -1
				for k in range(prvni + 1, zast.size()):
					if zast[k].stanoviste == konec:
						posledni_i = k
						break
				if posledni_i < prvni + 2:
					continue
				var ok := true
				for k in range(prvni + 1, posledni_i + 1):
					if zast[k].cil[0] <= zast[k - 1].cil[0] or casy[k * 2] < 0:
						ok = false
				for k in range(prvni, posledni_i):
					if casy[k * 2 + 1] < 0:
						ok = false
				if not ok:
					continue
				vybrana = {"id": "%s/%s/%s" % [o[0], o[1], o[2]], "odjezd": odjezd, "prvni": prvni, "posledni": posledni_i,
					"druh": o[0], "linka": o[1], "odkud": jr.stanoviste[zacatek][0], "kam": jr.stanoviste[konec][0],
					"cil": spoj.cil, "udalost": {"klic": "%d:%s" % [den, spoj.id], "den": den, "spoj": spoj,
						"zacatek": den * JizdniRad.DEN + spoj.zacatek, "konec": den * JizdniRad.DEN + spoj.konec}}
		if not vybrana.is_empty():
			out.append(vybrana)
	return out


## Zastávky směny s plánovanými časy příjezdu a odjezdu (shiftStops).
static func zastavky(nabidka: Dictionary, jr: JizdniRad) -> Array:
	var spoj: Dictionary = nabidka.udalost.spoj
	var casy: PackedInt32Array = spoj.casy
	var out: Array = []
	for i in range(nabidka.prvni, nabidka.posledni + 1):
		var z: Dictionary = spoj.zastaveni[i]
		var st: Array = jr.stanoviste[z.stanoviste]
		var s: float = z.cil[0]
		var prijezd := 0.0
		var odjezd := 0.0
		if out.is_empty():
			prijezd = nabidka.odjezd - PREDSTIH
			odjezd = nabidka.odjezd
		else:
			var pred: Dictionary = out[-1]
			var jizda := float(JizdniRad.cas(casy[i * 2]) - JizdniRad.cas(casy[i * 2 - 1]))
			var stani := float(JizdniRad.cas(casy[i * 2 + 1]) - JizdniRad.cas(casy[i * 2])) if casy[i * 2 + 1] >= 0 else 0.0
			# cestovní čas má rezervu na průjezd a světla
			prijezd = pred.odjezd + maxf(jizda, (s - pred.s) / 6.6 + 28.0)
			odjezd = prijezd + maxf(stani, JizdniRad.STANI)
		var kod: String = st[3]
		out.append({"i": i, "s": s, "nazev": st[0], "x": st[1], "z": st[2],
			"nastupiste": kod.get_slice("/", 1) if kod.contains("/") else "", "prijezd": prijezd, "odjezd": odjezd})
	return out


## Výsledek směny (shiftResult).
static func vysledek(r: Dictionary, konecna: bool) -> Dictionary:
	var pocet: int = r.zastavky.size()
	var body_zastavky := roundi(float(r.obslouzeno) * 45.0 / pocet)
	var presnost := maxi(0, roundi(20.0 - r.zpozdeni / maxf(1.0, r.obslouzeno) / 4.0 - r.predcasne / 3.0))
	var pravidla := maxi(0, roundi(25.0 - r.cervena * 7 - r.prednost * 4 - r.rychlost * 0.5 - r.zasahy * 4))
	var plynulost := maxi(0, roundi(10.0 - r.prudce * 1.6))
	var skore := body_zastavky + presnost + pravidla + plynulost
	var uspech: bool = konecna and r.obslouzeno >= ceili(pocet * 0.8) and skore >= 60
	var vzdalenost: float = r.zastavky[-1].s - r.zastavky[0].s
	var plna := 95.0 + 0.16 * vzdalenost + pocet * 20.0
	return {"nazev": nazev(r.nabidka), "stav": "vyplaceno" if uspech else "bez_odmeny",
		"poznamka": "Konečná bez obsluhy" if not konecna else ("" if uspech else "Pro výplatu je třeba 60 bodů a obsluha alespoň 80 % zastávek"),
		"castka": roundi(plna * skore / 500.0) * 5 if uspech else 0, "skore": skore, "obslouzeno": r.obslouzeno,
		"pocet": pocet, "body_zastavky": body_zastavky, "presnost": presnost, "pravidla": pravidla, "plynulost": plynulost,
		"cervena": r.cervena}


## Zrychlení vozu podél trasy (shiftMotion): přilnavost omezuje sílu, nouzová brzda tramvaje
## používá i kolejnicovou brzdu.
static func pohyb(v: float, zrychleni: float, plyn: float, nouze: bool, tramvaj: bool, dt: float) -> Vector2:
	var prilnavost := (0.24 if tramvaj else 0.62) * 9.81
	var sila := plyn * (1.22 if tramvaj else 1.45) if plyn > 0.0 else plyn * 2.6 - 0.28
	var cil := -minf(4.6, prilnavost + (2.3 if tramvaj else 0.0)) if nouze else clampf(sila, -prilnavost, prilnavost)
	var zmena := (9.0 if nouze else 2.8) * dt
	var a := clampf(cil, zrychleni - zmena, zrychleni + zmena)
	var nova := clampf(v + (zrychleni + a) * 0.5 * dt, 0.0, 17.0)
	return Vector2(nova, 0.0 if nova == 0.0 and a < 0.0 else a)


func nacti(d: Variant) -> void:
	if not d is Dictionary:
		return
	if (d as Dictionary).get("aktivni", "") is String and str((d as Dictionary).get("aktivni", "")) != "":
		posledni = {"nazev": d.aktivni, "stav": "preruseno", "castka": 0, "poznamka": "Načtení uložené hry"}
	elif (d as Dictionary).get("posledni", {}) is Dictionary and STAVY.has((d as Dictionary).get("posledni", {}).get("stav", "")):
		posledni = d.posledni


func stav() -> Dictionary:
	return {"aktivni": nazev(aktivni.nabidka) if not aktivni.is_empty() else "", "posledni": posledni}


func nabidky_ted() -> Array:
	return nabidky(hra.mhd.jr, hra.ted())


## Začne směnu. Vrací chybu ("" = v pořádku).
func zacni(id: String) -> String:
	if not aktivni.is_empty() or not hra.zakazky.zakazka.is_empty():
		return "Nejdřív ukonči rozpracovanou zakázku nebo směnu."
	if hra.policie and hra.policie.hledanost > 0:
		return "Ke směně nastup až po skončení policejního pátrání."
	if hra.rezim != "pesky":
		return "Před nástupem do směny vystup z vozidla."
	var nabidka := {}
	for n: Dictionary in nabidky_ted():
		if n.id == id:
			nabidka = n
	if nabidka.is_empty():
		return "Spoj teď není k dispozici."
	var zast := zastavky(nabidka, hra.mhd.jr)
	aktivni = {"nabidka": nabidka, "zastavky": zast, "index": 0, "obslouzeno": 1, "stani": 0.0,
		"zpozdeni": 0.0, "predcasne": 0.0, "cervena": 0, "prednost": 0, "rychlost": 0.0, "zasahy": 0,
		"prudce": 0.0, "minule": {}, "chraneno": false, "odjezd": {}, "v": 0.0, "a": 0.0, "hotovo": {}}
	hra.cas_zivy = false
	hra.nastav_cas(fposmod(nabidka.odjezd - PREDSTIH, JizdniRad.DEN) / 3600.0, floori((nabidka.odjezd - PREDSTIH) / JizdniRad.DEN))
	var vuz := hra.mhd.prevezmi(nabidka.udalost, zast[0].s)
	aktivni.vuz = vuz
	vuz.dvere_otevrene = true
	vuz.index = zast[0].i
	hra.ridit_mhd(vuz)
	hra.uloz()
	return ""


func zastavka() -> Dictionary:
	return {} if aktivni.is_empty() else aktivni.zastavky[aktivni.index]


## F: otevřít nebo zavřít dveře (nebo znovu vyplatit vyhodnocenou směnu).
func dvere() -> void:
	var r := aktivni
	if r.is_empty():
		return
	var z := zastavka()
	var v: VuzMhd = r.vuz
	if v.dvere_otevrene:
		if r.stani < JizdniRad.STANI:
			hra.hud.zprava("Nech cestujícím čas na nástup a výstup.", 2)
			return
		v.dvere_otevrene = false
		if v.typ == "tram":
			hra.zvuky.efekt("zvonek", v.clanky[0].global_position)
		if r.index == r.zastavky.size() - 1:
			_dokonci(true)
			return
		r.odjezd = {"s": v.s, "cas": z.odjezd}
		r.index += 1
		v.index = zastavka().i
		hra.zvuky.ohlas(zastavka().nazev)
		return
	if r.v > STOJI:
		hra.hud.zprava("Dveře lze otevřít až po zastavení.", 2)
		return
	if absf(v.s - z.s) > DOSAH_ZASTAVKY:
		hra.hud.zprava("Zastav přímo u stanoviště %s." % z.nazev, 2)
		return
	r.v = 0.0
	r.obslouzeno += 1
	r.stani = 0.0
	r.zpozdeni += maxf(0.0, hra.ted() - z.prijezd - 10.0)
	v.dvere_otevrene = true


func _physics_process(dt: float) -> void:
	if aktivni.is_empty() or hra == null:
		return
	var r := aktivni
	var v: VuzMhd = r.vuz
	if not is_instance_valid(v):
		ukonci("preruseno", "Vůz zmizel")
		return
	if v.dvere_otevrene:
		r.v = 0.0
		r.a = 0.0
		r.stani += dt
		v.ridit(v.s, dt)
		_ukaz()
		return
	var z := zastavka()
	var plyn := Vstup.plyn()
	var nouze := Vstup.brzda()
	var p := pohyb(r.v, r.a, plyn, nouze, v.typ == "tram", dt)
	r.a = p.y
	# volno před vozem: auta, jiné vozy MHD a chodci v jízdní dráze
	var vpred := v.smer()
	var celo := v.celo()
	var volno := 60.0
	for o: Node3D in _prekazky(v):
		var d := o.global_position - celo
		var podel := d.x * vpred.x + d.z * vpred.z
		var napric := absf(d.x * vpred.z - d.z * vpred.x)
		# protijedoucí vozidlo se míjí v protisměru, blokuje jen při čelním střetu
		var sirka := 1.9
		if not o is Postava and not o is Chodec and o.global_basis.z.dot(vpred) < -0.5:
			sirka = 1.0
		if podel > 0.0 and podel < 45.0 and napric < sirka and absf(d.y) < 2.8 and podel - 2.8 < volno:
			volno = podel - 2.8
			r.prekazka = o
	_odtah(r, volno, dt)
	var bezpecna := sqrt(maxf(0.0, volno) * 5.2)
	r.mezera = roundi(maxf(0.0, volno)) if volno < maxf(16.0, r.v * r.v / 4.0 + 8.0) else -1
	if r.v > maxf(3.3, bezpecna + 0.9) and not r.chraneno:
		r.zasahy += 1
		r.chraneno = true
		hra.hud.zprava("Zásah brzdy kvůli překážce před vozem.", 2)
	elif volno > 18.0:
		r.chraneno = false
	if r.v > 3.0 and (nouze or r.v > bezpecna + 0.9):
		r.prudce += dt
	var nova := minf(p.x, bezpecna)
	if nova < p.x:
		r.a = minf(0.0, r.a)
	r.v = nova
	var posun := minf(r.v * dt, maxf(0.0, volno))
	if r.v > LIMIT + 0.55:
		r.rychlost += dt
	_semafory(r, v, posun)
	v.ridit(minf(v.trasa.delka, v.s + posun), dt)
	if not r.odjezd.is_empty() and v.s - r.odjezd.s > 0.8:
		r.predcasne += maxf(0.0, r.odjezd.cas - hra.ted() - 2.0)
		r.odjezd = {}
	_ukaz()
	if v.s <= z.s + DOSAH_ZASTAVKY:
		return
	hra.hud.zprava("Vynechaná zastávka · %s" % z.nazev, 3)
	print("Směna: vynechaná zastávka %s (s %.1f, vůz %.1f, %.1f m/s)" % [z.nazev, z.s, v.s, r.v])
	if r.index == r.zastavky.size() - 1:
		_dokonci(false)
	else:
		r.index += 1
		v.index = zastavka().i


## Zaparkované nebo opuštěné auto, které stojí v trati déle než 10 s, odveze odtahová služba.
func _odtah(r: Dictionary, volno: float, dt: float) -> void:
	var o: Variant = r.get("prekazka")
	if volno > 1.0 or not o is Auto or not is_instance_valid(o) or (o as Auto).has_meta("garaz") or o == hra.auto_hrace \
			or (o as Auto).linear_velocity.length() > 0.3:
		r.odtah = 0.0
		return
	r.odtah = float(r.get("odtah", 0.0)) + dt
	if r.odtah > 10.0:
		r.odtah = 0.0
		hra.doprava.zaparkovana.erase(o)
		(o as Auto).queue_free()
		r.prekazka = null
		hra.hud.zprava("Auto stojící v trati odvezla odtahová služba.", 3)


func _prekazky(v: VuzMhd) -> Array:
	var out: Array = []
	if hra.doprava:
		for a in hra.doprava.auta:
			if is_instance_valid(a):
				out.append(a)
	for a: Node in hra.auta.get_children():
		if a is Node3D:
			out.append(a)
	for o: VuzMhd in hra.mhd.vozy.values():
		if o != v and is_instance_valid(o):
			for c in o.clanky:
				out.append(c)
	if hra.chodci:
		for c: Node in hra.chodci.get_children():
			if c is Node3D:
				out.append(c)
	if hra.chodec.visible:
		out.append(hra.chodec)
	return out


## Průjezd semaforem: nejbližší návěstidlo pro vozidla ve směru jízdy do 42 m (controlAhead).
func _semafory(r: Dictionary, v: VuzMhd, posun: float) -> void:
	r.signal = {}
	var rz: Rizeni = hra.doprava.rizeni if hra.doprava else null
	if rz == null:
		return
	var celo := v.celo()
	var smer := v.smer()
	var nej := 42.0
	var vybrane := -1
	var ci := Mapa.index_dlazdice(celo.x, celo.z)
	var kandidati: Array = []
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			kandidati.append_array(rz.hlavy_dlazdice.get(ci + dx + dz * Mapa.sloupce, []))
	var h := rz.hlavy
	for i: int in kandidati:
		var o := i * 8
		if h[o + 7] > 0.5 or h[o + 6] < 0.0 or r.hotovo.has(i):
			continue
		var dx: float = h[o] - celo.x
		var dz: float = h[o + 2] - celo.z
		var vzd := dx * smer.x + dz * smer.z
		if vzd < -0.35 or vzd >= nej or h[o + 3] * smer.x + h[o + 4] * smer.z < 0.77:
			continue
		if absf(dx * smer.z - dz * smer.x) > 7.5:
			continue
		nej = vzd
		vybrane = i
	if vybrane < 0:
		return
	var o := vybrane * 8
	var barva := rz.svetlo(int(h[o + 6]), int(h[o + 5]))
	r.signal = {"barva": barva, "vzdalenost": nej}
	if posun <= 0.0 or nej > posun + 2.0:
		return
	r.hotovo[vybrane] = true
	if barva == "red":
		r.cervena += 1
		hra.hud.zprava("Průjezd na červenou.", 2)


func _ukaz() -> void:
	var r := aktivni
	var z := zastavka()
	var v: VuzMhd = r.vuz
	var metry := maxi(0, roundi(z.s - v.s))
	var do_prijezdu := ceili(z.prijezd - hra.ted())
	var zbyva := ceili(z.odjezd - hra.ted())
	var stoji: bool = absf(z.s - v.s) <= DOSAH_ZASTAVKY and float(r.v) <= STOJI
	var akce := "%d m · příjezd %s%s" % [metry, JizdniRad.format_cas(z.prijezd), (" · +%d s" % -do_prijezdu) if do_prijezdu < 0 else ""]
	if v.dvere_otevrene:
		var zbyva_stani := ceili(JizdniRad.STANI - r.stani)
		if zbyva_stani > 0:
			akce = "Dveře otevřeny · obsluha %d s" % zbyva_stani
		elif r.index == r.zastavky.size() - 1:
			akce = "F · zavřít dveře a vyhodnotit"
		elif zbyva > 0:
			akce = "Odjezd za %d s · F zavře dveře" % zbyva
		else:
			akce = "F · zavřít dveře a vyjet"
	elif stoji:
		akce = "F · otevřít dveře"
	elif not r.odjezd.is_empty() and hra.ted() < r.odjezd.cas:
		akce = "Odjezd za %d s" % ceili(r.odjezd.cas - hra.ted())
	var barvy := {"red": "Červená", "amber": "Žlutá", "green": "Zelená", "off": "Semafor mimo provoz"}
	var dalsi := ""
	var sig: Dictionary = r.get("signal", {})
	if not v.dvere_otevrene and not sig.is_empty() and sig.vzdalenost > 0.0:
		dalsi = "\n%s · %d m" % [barvy.get(sig.barva, sig.barva), ceili(sig.vzdalenost)]
	var mezera := ""
	if not v.dvere_otevrene and int(r.get("mezera", -1)) >= 0:
		mezera = "\nProvoz vpředu · %d m" % r.mezera
	hra.hud.zakazka("%s %s · směna\n%d/%d · %s%s\n%s%s%s" % [DRUHY[r.nabidka.druh], r.nabidka.linka, r.index + 1,
		r.zastavky.size(), z.nazev, (" · st. " + z.nastupiste) if z.nastupiste != "" else "", akce, dalsi, mezera])
	hra.hud.rychlost(r.v * 3.6)


func _dokonci(konecna: bool) -> void:
	var r := aktivni
	r.v = 0.0
	var v := vysledek(r, konecna)
	posledni = v
	if v.castka > 0:
		hra.pridej_penize(v.castka)
		hra.statistiky["smeny"] = int(hra.statistiky.get("smeny", 0)) + 1
	_uvolni()
	hra.uloz()
	hra.hud.zprava("%s · %d/100%s" % [STAVY[v.stav], v.skore, (" · +%d Kč" % v.castka) if v.castka > 0 else ""], 6.5)


func ukonci(stav_smeny := "zruseno", poznamka := "") -> void:
	if aktivni.is_empty():
		return
	posledni = {"nazev": nazev(aktivni.nabidka), "stav": stav_smeny, "poznamka": poznamka, "castka": 0}
	_uvolni()
	hra.uloz()
	hra.hud.zprava("Směna · %s%s" % [STAVY[stav_smeny], (" · " + poznamka) if poznamka != "" else ""], 4)


func _uvolni() -> void:
	var v: VuzMhd = aktivni.vuz
	aktivni = {}
	hra.hud.zakazka("")
	if is_instance_valid(v):
		hra.mhd.vrat(v)
	if hra.rezim == "mhd":
		hra.vystoupit_z_mhd(true)


## Text posledního výsledku pro menu.
static func text_vysledku(v: Dictionary) -> String:
	if v.is_empty():
		return ""
	var t := "%s · %s" % [v.get("nazev", ""), STAVY.get(v.get("stav", ""), "")]
	if v.has("skore"):
		t += " · %d/100 (zastávky %d/%d, přesnost %d, pravidla %d, plynulost %d)" % [v.skore, v.obslouzeno, v.pocet,
			v.presnost, v.pravidla, v.plynulost]
	if int(v.get("castka", 0)) > 0:
		t += " · +%d Kč" % v.castka
	if str(v.get("poznamka", "")) != "":
		t += " · " + str(v.poznamka)
	return t
