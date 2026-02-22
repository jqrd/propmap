#!/usr/bin/env python3
"""
One-time data prep script: downloads IMD 2019 data and LSOA boundaries,
joins them, and writes data/west-london-imd.geojson.

No pip installs required — uses only Python stdlib.
"""
import csv
import json
import os
import urllib.request
import urllib.parse

# -----------------------------------------------------------
# Config
# -----------------------------------------------------------
TARGET_BOROUGHS = {
    "Hammersmith and Fulham",
    "Richmond upon Thames",
    "Wandsworth",
    "Hounslow",
    "Kensington and Chelsea",
}

IMD_CSV_URL = (
    "https://assets.publishing.service.gov.uk/media/"
    "5dc407b440f0b6379a7acc8d/File_7_-_All_IoD2019_Scores__Ranks__Deciles_and_Population_Denominators_3.csv"
)

ONS_FEATURE_SERVER = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "LSOA_2011_Boundaries_Super_Generalised_Clipped_BSC_EW_V4/FeatureServer/0/query"
)

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "app", "data", "west-london-imd.geojson")

# -----------------------------------------------------------
# Step 1: Download and parse IMD CSV
# -----------------------------------------------------------
def download_imd():
    print("Downloading IMD 2019 CSV …")
    req = urllib.request.Request(IMD_CSV_URL, headers={"User-Agent": "propmap-builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        content = resp.read().decode("utf-8-sig")  # strip BOM if present

    reader = csv.DictReader(content.splitlines())
    imd_by_lsoa = {}
    for row in reader:
        borough = row.get("Local Authority District name (2019)") or row.get("Local Authority District Name (2019)", "")
        if borough in TARGET_BOROUGHS:
            lsoa_code = row.get("LSOA code (2011)") or row.get("LSOA Code (2011)", "")
            lsoa_name = row.get("LSOA name (2011)") or row.get("LSOA Name (2011)", "")
            imd_score_raw = row.get("Index of Multiple Deprivation (IMD) Score") or row.get("Index of Multiple Deprivation (IMD) Score", "")
            imd_decile_raw = row.get("Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)") or ""
            if not lsoa_code:
                continue
            try:
                imd_score = round(float(imd_score_raw), 2)
            except (ValueError, TypeError):
                imd_score = None
            try:
                imd_decile = int(imd_decile_raw)
            except (ValueError, TypeError):
                imd_decile = None

            imd_by_lsoa[lsoa_code] = {
                "lsoa_name": lsoa_name,
                "borough": borough,
                "imd_score": imd_score,
                "imd_decile": imd_decile,
            }

    print(f"  Found {len(imd_by_lsoa)} LSOAs in target boroughs.")
    return imd_by_lsoa


# -----------------------------------------------------------
# Step 2: Download LSOA boundaries from ONS FeatureServer
# -----------------------------------------------------------
def round_coords(coords, dp=5):
    """Recursively round coordinate arrays."""
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], dp), round(coords[1], dp)]
    return [round_coords(c, dp) for c in coords]


def download_boundaries(lsoa_codes, batch_size=50):
    """Download LSOA boundaries in batches using POST to avoid URL length limits."""
    print(f"Downloading LSOA boundaries for {len(lsoa_codes)} LSOAs (batch_size={batch_size}) …")
    all_features = []
    batches = [lsoa_codes[i:i + batch_size] for i in range(0, len(lsoa_codes), batch_size)]

    for idx, batch in enumerate(batches):
        codes_sql = ",".join(f"'{c}'" for c in batch)
        where = f"LSOA11CD IN ({codes_sql})"
        post_data = urllib.parse.urlencode({
            "where": where,
            "outFields": "LSOA11CD,LSOA11NM",
            "outSR": "4326",
            "f": "geojson",
            "returnGeometry": "true",
        }).encode("utf-8")
        req = urllib.request.Request(
            ONS_FEATURE_SERVER,
            data=post_data,
            headers={
                "User-Agent": "propmap-builder/1.0",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
        features = data.get("features", [])
        all_features.extend(features)
        print(f"  Batch {idx + 1}/{len(batches)}: {len(features)} features (total so far: {len(all_features)})")

    print(f"  Received {len(all_features)} boundary features total.")
    return all_features


# -----------------------------------------------------------
# Step 3: Join and write GeoJSON
# -----------------------------------------------------------
def build_geojson(imd_by_lsoa, boundary_features):
    out_features = []
    matched = 0
    for feat in boundary_features:
        props = feat.get("properties", {})
        code = props.get("LSOA11CD", "")
        imd = imd_by_lsoa.get(code)
        if not imd:
            continue  # outside target boroughs
        matched += 1

        geom = feat.get("geometry", {})
        if geom.get("coordinates"):
            geom["coordinates"] = round_coords(geom["coordinates"])

        out_features.append({
            "type": "Feature",
            "properties": {
                "lsoa_code": code,
                "lsoa_name": imd["lsoa_name"],
                "borough": imd["borough"],
                "imd_score": imd["imd_score"],
                "imd_decile": imd["imd_decile"],
            },
            "geometry": geom,
        })

    print(f"  Joined {matched} features (of {len(boundary_features)} boundaries).")
    geojson = {"type": "FeatureCollection", "features": out_features}
    return geojson


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    imd_by_lsoa = download_imd()
    if not imd_by_lsoa:
        print("ERROR: No IMD data found for target boroughs. Check CSV column names.")
        return

    boundary_features = download_boundaries(list(imd_by_lsoa.keys()))
    geojson = build_geojson(imd_by_lsoa, boundary_features)

    out_path = os.path.abspath(OUT_PATH)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) // 1024
    print(f"\nWrote {len(geojson['features'])} features to {out_path} ({size_kb} KB)")


if __name__ == "__main__":
    main()
