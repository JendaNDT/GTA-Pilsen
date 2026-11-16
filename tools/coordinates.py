"""Převod WGS 84 (šířka, délka) ↔ herní metry (x na východ, z na jih)."""

# Stávající počátek a měřítko zachovávají polohu mapových vrstev a uložených her.
ORIGIN = {"lat": 49.7475, "lon": 13.3776, "kx": 72066.0, "ky": 111224.0}


def to_xz(lat, lon):
    return (lon - ORIGIN["lon"]) * ORIGIN["kx"], (ORIGIN["lat"] - lat) * ORIGIN["ky"]


def to_wgs84(x, z):
    return ORIGIN["lat"] - z / ORIGIN["ky"], ORIGIN["lon"] + x / ORIGIN["kx"]


def world_bounds(bbox):
    south, west, north, east = bbox
    min_x, max_z = to_xz(south, west)
    max_x, min_z = to_xz(north, east)
    return min_x, max_x, min_z, max_z
