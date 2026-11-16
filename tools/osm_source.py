"""Datum mapových dat pochází z hlavičky PBF, ne z času stažení nebo sestavení."""
from datetime import datetime, timezone

OSM_URL = "https://download.openstreetmap.fr/extracts/europe/czech_republic/plzensky-latest.osm.pbf"


def normalize_timestamp(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Chybí datum zdrojových dat OpenStreetMap.")
    # Stavové soubory OSM používají také escapované dvojtečky.
    text = value.strip().replace("\\:", ":")
    try:
        date = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Neplatné datum zdrojových dat OpenStreetMap: {value!r}") from error
    if date.tzinfo is None:
        raise ValueError("Datum zdrojových dat OpenStreetMap musí obsahovat časové pásmo.")
    return date.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_pbf_timestamp(path):
    import osmium

    source = osmium.io.File(str(path), "pbf")
    with osmium.io.Reader(source, osmium.osm.osm_entity_bits.NOTHING) as reader:
        value = reader.header().get("osmosis_replication_timestamp")
    return normalize_timestamp(value)


def extract_timestamp(extract):
    """Starší výřezy bez data je nutné znovu vyrobit z jejich zdrojového PBF."""
    if not extract.get("osmTimestamp"):
        raise ValueError("V extract.pkl chybí datum OSM. Spusťte znovu tools/extract_osm.py.")
    return normalize_timestamp(extract["osmTimestamp"])
