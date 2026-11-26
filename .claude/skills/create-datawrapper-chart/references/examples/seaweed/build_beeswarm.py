"""Beeswarm layout for the UNCTAD seaweed exports chart.

Datawrapper has no beeswarm chart type, so the vertical packing is computed here
and fed to Datawrapper as an ordinary y column called `Position`. Datawrapper
plots what it is given and does not rearrange anything.

Usage:
    python3 build_beeswarm.py seaweed_exports_2024_by_economy.csv [-o out.csv]

Input columns used: economy, processed_share_pct, total_seaweed_usd,
category_label, color_hex.

The layout is deterministic - the same input gives the same output. Rerun it when
the data changes; never hand-edit the Position column.
"""
import argparse
import csv
import math

# Geometry. Radii are expressed in x-axis units (percentage points) so the
# packing is internally consistent. MAX_R was tuned against the published figure.
MAX_R, MIN_R = 6.2, 0.55

# The ten economies the chart labels. Everything else gets a blank Label cell,
# so Datawrapper's "show labels from column" needs no per-point clicking.
LABEL = {
    "China", "Rep. of Korea", "Indonesia", "Chile", "Philippines",
    "Spain", "USA", "United Kingdom", "France", "Germany",
}


def load(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("economy")]
    recs = []
    for r in rows:
        label = r["category_label"]
        # Datawrapper silently fails to colour-match a category containing "<".
        # Strip the threshold; it belongs in the notes anyway.
        if "<" in label or ">" in label:
            label = label.split("(")[0].strip()
        recs.append({
            "country": r["economy"],
            "share": float(r["processed_share_pct"]),
            "value": float(r["total_seaweed_usd"]),
            "cat": label,
            "color": r.get("color_hex", ""),
        })
    return recs


def pack(recs):
    """Place each point at the y nearest zero that does not collide."""
    vmax = max(r["value"] for r in recs)
    for r in recs:
        r["r"] = MIN_R + (MAX_R - MIN_R) * math.sqrt(r["value"] / vmax)

    recs.sort(key=lambda r: -r["value"])          # biggest first, nearest centre
    placed = []
    for r in recs:
        x, rad = r["share"], r["r"]
        near = [p for p in placed if abs(p["share"] - x) < (rad + p["r"])]
        if not near:
            r["y"] = 0.0
        else:
            cands = [0.0]
            for p in near:
                gap = (rad + p["r"]) ** 2 - (x - p["share"]) ** 2
                if gap > 0:
                    off = math.sqrt(gap)
                    cands += [p["y"] + off, p["y"] - off]
            cands.sort(key=abs)
            for c in cands:
                if all((x - p["share"]) ** 2 + (c - p["y"]) ** 2
                       >= (rad + p["r"]) ** 2 - 1e-9 for p in near):
                    r["y"] = c
                    break
            else:
                r["y"] = max(cands, key=abs)
        placed.append(r)
    return recs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("-o", "--out", default="seaweed_beeswarm.csv")
    args = ap.parse_args()

    recs = pack(load(args.source))

    out = [{
        "Country": r["country"],
        "Derivative share": round(r["share"], 1),
        "Position": round(r["y"], 3),
        "Export value": int(round(r["value"])),
        "Category": r["cat"],
        "Label": r["country"] if r["country"] in LABEL else "",
    } for r in sorted(recs, key=lambda r: r["country"])]

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    ys = [r["y"] for r in recs]
    rs = [r["r"] for r in recs]
    lo = min(y - r for y, r in zip(ys, rs))
    hi = max(y + r for y, r in zip(ys, rs))
    print(f"{len(out)} economies -> {args.out}")
    print(f"y extent {lo:.2f} .. {hi:.2f}")
    print("Set the Datawrapper y-axis range manually to cover this, and set")
    print("plotHeightRatio so the plot is about 2.4x wider than tall.")
    cats = {}
    for r in recs:
        cats.setdefault(r["cat"], r["color"])
    for k, v in cats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
