"""Herní území – jediné místo, kde se nastavuje jeho rozsah.

Výškopis ČÚZK se stahuje v pravidelné síti s krokem DEM_STEP stupňů (server vrací čtvercové
pixely ve stupních), proto je rozsah území zadán jako počátek + celý počet pixelů.
"""

DEM_STEP = 1.8e-5            # ~2,0 m ve směru sever–jih, ~1,3 m ve směru západ–východ
DEM_COLS, DEM_ROWS = 25560, 9840
DEM_TILES = (9, 6)           # dlaždice stahování (sloupce, řady); větší kusy server odmítá chybou 500

SOUTH, WEST = 49.668, 13.255
NORTH = SOUTH + DEM_ROWS * DEM_STEP      # 49,8451
EAST = WEST + DEM_COLS * DEM_STEP        # 13,71508, za Dobřívem

# jih, západ, sever, východ
BBOX = (SOUTH, WEST, NORTH, EAST)

OSM_MARGIN = 0.004  # přesah pracovního výřezu, ve stupních
OSM_BBOX = (SOUTH - OSM_MARGIN, WEST - OSM_MARGIN, NORTH + OSM_MARGIN, EAST + OSM_MARGIN)
