# Seaweed beeswarm – how chart `ISjSH` is configured

Chart type: **Scatter Plot** (`d3-scatter-plot`).
Folder `441238` ("2026-09 Seaweed story"). Draft, unpublished. 11/11 on settings.
Editor: https://app.datawrapper.de/chart/ISjSH/visualize

Datawrapper has no beeswarm type. The vertical packing is precomputed in the
`Position` column by `build_beeswarm.py`; Datawrapper plots what it is given.

---

## Data

`seaweed_v2.csv`, 110 economies.

| Column | Role |
|---|---|
| `Country` | tooltip |
| `Derivative share` | X, 0–100 |
| `Position` | Y, the precomputed offset. No meaning of its own |
| `Export value` | size, total 2024 seaweed exports in dollars |
| `Category` | colour |
| `Label` | the ten annotated economies; blank for the rest |

Source: `seaweed_exports_2024_by_economy.csv` (teelmo's file, with the category
assignments already made). Derived from UN COMTRADE: derivatives are HS 130231
agar-agar, HS 130239 carrageenan, HS 391310 alginic acid; raw is HS 121221
food-grade and HS 121229 non-food-grade.

---

## Encoding

- X → `Derivative share`, Y → `Position`, Size → `Export value`,
  Color → `Category`, Labels → `Label`
- `color-by-column: true` – **without this every point renders in the base colour**

| Category | Hex |
|---|---|
| Raw or lightly processed | `#72BF44` |
| Mixed | `#FBAF17` |
| Highly processed | `#009EDB` |
| Limited reported trade | `#AEA29A` |

These are UNCTAD palette values. The originally published figure used a
different green and orange; this version was moved onto the palette.

**The category label must not contain `<`.** The source file had
`Limited reported trade (<$100k)`, which Datawrapper silently failed to match –
the category vanished from the legend and all 39 economies rendered blue. The
threshold lives in the notes instead.

---

## Two load-bearing settings

Not cosmetic. Get these wrong and the chart is broken, not just ugly.

- **Y axis range fixed at −18 to 18.** On automatic Datawrapper rescales and the
  bubbles overlap.
- **`plotHeightMode: "ratio"`, `plotHeightRatio: 0.36`** – the plot must be about
  2.4× wider than tall, because that is the ratio the packing assumed. A taller
  plot renders the circles as ellipses and opens gaps.

## The rest

- X axis range 0–100, ticks every 10, format `0%`.
  **Feed it 0–100, not fractions** – Datawrapper's `0%` appends the sign without
  multiplying.
- `y-pos: "off"` hides the y axis entirely.
- `x-grid-lines: "ticks"` – `"off"` also removes the tick labels.
- `auto-labels: false` so only the ten named economies are labelled.
- `max-size: 62`.
- Two `range-annotations`: dashed vertical lines at 40 and 60 in `#8A8178`,
  `y0:'-18'`, `y1:'18'`.
- Two `text-annotations` at `y: 16.4` reading "40% threshold" and "60% threshold".

---

## Still open

1. The "Derivative share" axis title overlaps the China cluster. Two clicks in
   Refine; I did not find the metadata key.
2. Germany and France have dropped their labels – Datawrapper hides colliding
   ones. May need manual nudging.
3. `max-size` 62 looks right against the published figure; tune if not.

Then it is teelmo's to publish.
