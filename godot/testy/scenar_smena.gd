extends Scenar
## Směna řidiče tramvaje 1: převzetí skutečného spoje, jízda po zastávkách s obsluhou dveří,
## vyhodnocení a výplata. Řidič-automat zastavuje u každého stanoviště.
## Spuštění: godot --headless --path godot testy/scenar_smena.tscn

const DEN_ZKOUSKY := "2026-11-20"


func _init() -> void:
	_limit = 1800.0


func scenar() -> void:
	krok("Nabídka směn")
	await cekej_na_svet()
	hra.cas_zivy = false
	hra.nastav_cas(9.5, JizdniRad.den_z_textu(DEN_ZKOUSKY))
	var nabidky := hra.smeny.nabidky_ted()
	over(nabidky.size() == Smeny.OKRUHY.size(), "nabízí se %d okruhů (tramvaj 1, trolejbus 16, autobus 30)" % nabidky.size())
	var tram := {}
	for n: Dictionary in nabidky:
		print("  ", Smeny.nazev(n), " · odjezd ", JizdniRad.format_cas(n.odjezd), " · ", n.posledni - n.prvni + 1, " zastávek")
		if n.druh == "tram" and tram.is_empty():
			tram = n
	over(not tram.is_empty(), "je k dispozici tramvaj 1")
	if tram.is_empty():
		return

	krok("Nástup do směny")
	var chyba := hra.smeny.zacni(tram.id)
	over(chyba == "", "směna začala %s" % chyba)
	await cekej(0.5)
	var r: Dictionary = hra.smeny.aktivni
	var v: VuzMhd = r.vuz
	over(hra.rezim == "mhd" and hra.jizda == v and v.has_meta("smena"), "hráč řídí vůz %s" % v.nazev_spoje())
	over(absf(hra.ted() - (tram.odjezd - Smeny.PREDSTIH)) < 3.0, "čas je 5 s před odjezdem (%s)" % JizdniRad.format_cas(hra.ted()))
	await snimek("01-smena-start")

	krok("Jízda po zastávkách")
	Engine.time_scale = 3.0
	var dt := 1.0 / Engine.physics_ticks_per_second
	var t := 0.0
	var pocet: int = r.zastavky.size()
	while not hra.smeny.aktivni.is_empty() and t < 1500.0:
		var z: Dictionary = hra.smeny.zastavka()
		var zbyva: float = z.s - v.s
		if v.dvere_otevrene:
			Vstup.dotyk_pohyb = Vector2.ZERO
			# zavřít dveře po obsluze a nejdřív v čase odjezdu
			if hra.smeny.aktivni.stani >= JizdniRad.STANI and hra.ted() >= z.odjezd - 1.0:
				hra._akce("nastoupit")
		elif absf(zbyva) <= 1.5 and hra.smeny.aktivni.v <= Smeny.STOJI:
			Vstup.dotyk_pohyb = Vector2.ZERO
			hra._akce("nastoupit")
		else:
			var rychlost: float = hra.smeny.aktivni.v
			var cilova := minf(11.0, sqrt(maxf(0.0, zbyva - 0.8) * 2.0 * 0.9))
			var plyn := clampf((cilova - rychlost) * 0.8, -1.0, 1.0)
			Vstup.dotyk_pohyb = Vector2(0, plyn)
		await get_tree().physics_frame
		t += dt * Engine.time_scale
		if fmod(t, 20.0) < dt * Engine.time_scale and not hra.smeny.aktivni.is_empty():
			var a: Dictionary = hra.smeny.aktivni
			print("  [%3.0f s] zastávka %d/%d %s · zbývá %.0f m · %.0f km/h · dveře %s · vpředu %s" % [t, a.index + 1, pocet,
				z.nazev, zbyva, a.v * 3.6, v.dvere_otevrene, str(a.get("mezera", -1))])
	Engine.time_scale = 1.0
	Vstup.dotyk_pohyb = Vector2.ZERO
	var vys: Dictionary = hra.smeny.posledni
	print("  ", Smeny.text_vysledku(vys))
	over(hra.smeny.aktivni.is_empty(), "směna skončila za %.0f s herního času" % t)
	over(vys.get("obslouzeno", 0) == pocet, "obslouženo %d z %d zastávek" % [vys.get("obslouzeno", 0), pocet])
	over(vys.get("stav", "") == "vyplaceno" and int(vys.get("castka", 0)) > 0, "směna je zaplacená (%d Kč, %d bodů)" % [vys.get("castka", 0), vys.get("skore", 0)])
	over(hra.rezim == "pesky", "hráč po směně vystoupil")
	over(not v.has_meta("smena"), "vůz se vrátil jízdnímu řádu")
	var u := Ulozeni.nacti()
	over((u.smeny as Dictionary).get("posledni", {}).get("stav", "") == "vyplaceno", "výsledek je v uložené hře")
