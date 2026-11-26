"""Example charts for the UNCTAD chart guidelines handbook.

Regenerates the 15 SVGs the handbook embeds. All examples use invented but
plausible data - no real UNCTAD figures appear, so nothing in the handbook can
be mistaken for a published statistic.

    python3 make_figs.py        # writes *.svg next to this file

The handbook's HTML references these as charts/<name>.svg.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.lines import Line2D
import numpy as np
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# ---- UNCTAD palette -------------------------------------------------------
BLUE      = "#009EDB"   # UN blue        - first colour
YELLOW    = "#FBAF17"   # UN yellow      - second
DARKBLUE  = "#004987"   # UN dark blue   - third
OCHRE     = "#B06E2A"   # UN dark yellow - fourth
LIGHTBLUE = "#C5DFEF"
PURPLE    = "#A05FB4"
GREEN     = "#72BF44"
RED       = "#ED1847"
WARM_GREY = "#AEA29A"   # a named group, e.g. "Other"
PALE_GREY = "#DED9D5"   # background / context series

INK, MUTED, GRID = "#1a1a1a", "#6f6f6f", "#e8e6e3"
LW = 3.0        # the default thick line

plt.rcParams.update({
    "font.family": "Liberation Sans",
    "font.size": 9,
    "text.color": INK,
    "axes.labelcolor": MUTED,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "axes.edgecolor": "#cfcdc8",
    "svg.fonttype": "none",
    "figure.dpi": 100,
})


def frame(ax, ygrid=True):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color("#cfcdc8")
    ax.spines["bottom"].set_linewidth(0.8)
    if ygrid:
        ax.yaxis.grid(True, color=GRID, linewidth=0.8)
        ax.set_axisbelow(True)
    ax.tick_params(length=0, labelsize=8.5)


def years_axis(ax):
    ax.xaxis.set_major_locator(mticker.MultipleLocator(5))
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda v, p: "%d" % v))


def top_legend(ax, entries, ncol=None):
    """Legend above the plot, left aligned - the web default."""
    handles = [Line2D([0], [0], color=c, lw=2.6, linestyle=ls) for _, c, ls in entries]
    ax.legend(handles, [n for n, _, _ in entries], loc="lower left",
              bbox_to_anchor=(0, 1.02, 1, 0.2), ncol=ncol or len(entries),
              frameon=False, fontsize=8, handlelength=1.5, handletextpad=0.5,
              columnspacing=1.4, borderaxespad=0)


def save(fig, name):
    fig.savefig(os.path.join(OUT, name + ".svg"), format="svg",
                bbox_inches="tight", pad_inches=0.06, transparent=True)
    plt.close(fig)
    print("wrote", name)


YEARS = np.arange(2010, 2025)


def series(start, growth, wobble, seed):
    rng = np.random.default_rng(seed)
    v = [start]
    for _ in range(len(YEARS) - 1):
        v.append(v[-1] * (1 + growth + rng.normal(0, wobble)))
    return np.array(v)


def fig_order():
    fig, ax = plt.subplots(figsize=(5.1, 2.6))
    data = [("Asia", series(100, 0.055, 0.012, 1), BLUE),
            ("Africa", series(72, 0.041, 0.014, 2), YELLOW),
            ("Latin America", series(58, 0.028, 0.013, 3), DARKBLUE),
            ("Oceania", series(34, 0.018, 0.015, 4), OCHRE)]
    for _, v, c in data:
        ax.plot(YEARS, v, color=c, linewidth=LW, solid_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(0, 250)
    ax.set_yticks([0, 50, 100, 150, 200, 250]); years_axis(ax)
    top_legend(ax, [(n, c, "-") for n, _, c in data])
    save(fig, "01-colour-order")


def fig_too_many():
    fig, ax = plt.subplots(figsize=(5.1, 2.6))
    names = ["Asia", "Africa", "Latin America", "Oceania", "Caribbean",
             "Central Asia", "Middle East", "Southern Europe", "Pacific"]
    palette = [BLUE, YELLOW, DARKBLUE, OCHRE, PURPLE, GREEN, RED, LIGHTBLUE, "#5B2C86"]
    for i, (n, c) in enumerate(zip(names, palette)):
        ax.plot(YEARS, series(30 + i * 9, 0.03 + i * 0.004, 0.016, 10 + i),
                color=c, linewidth=2.2)
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(0, None); years_axis(ax)
    top_legend(ax, [(n, c, "-") for n, c in zip(names, palette)], ncol=5)
    save(fig, "02a-too-many-series")


def fig_grouped():
    fig, ax = plt.subplots(figsize=(5.1, 2.6))
    data = [("Asia", series(100, 0.055, 0.012, 1), BLUE),
            ("Africa", series(72, 0.041, 0.014, 2), YELLOW),
            ("Latin America", series(58, 0.028, 0.013, 3), DARKBLUE),
            ("Oceania", series(34, 0.018, 0.015, 4), OCHRE),
            ("Other regions", series(46, 0.022, 0.012, 9), WARM_GREY)]
    for _, v, c in data:
        ax.plot(YEARS, v, color=c, linewidth=LW, solid_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(0, 250)
    ax.set_yticks([0, 50, 100, 150, 200, 250]); years_axis(ax)
    top_legend(ax, [(n, c, "-") for n, _, c in data], ncol=5)
    save(fig, "02b-grouped-other")


def fig_highlight():
    fig, ax = plt.subplots(figsize=(5.1, 2.6))
    rng = np.random.default_rng(7)
    for i in range(7):
        ax.plot(YEARS, series(28 + i * 6, 0.012 + rng.random() * 0.01, 0.013, 40 + i),
                color=PALE_GREY, linewidth=2.2)
    ax.plot(YEARS, series(46, 0.072, 0.011, 99), color=BLUE, linewidth=LW,
            solid_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(0, 150)
    ax.set_yticks([0, 50, 100, 150]); years_axis(ax)
    top_legend(ax, [("Digitally deliverable services", BLUE, "-"),
                    ("Other services categories", PALE_GREY, "-")])
    save(fig, "03-highlight")


def fig_pie():
    fig, ax = plt.subplots(figsize=(3.2, 2.7))
    ax.pie([21, 19, 17, 14, 11, 8, 6, 4],
           colors=[BLUE, YELLOW, DARKBLUE, OCHRE, PURPLE, GREEN, RED, LIGHTBLUE],
           startangle=90, wedgeprops=dict(linewidth=1.4, edgecolor="white"))
    ax.set_xlim(-1.9, 1.9); ax.set_ylim(-1.5, 1.5)
    ax.set_aspect("equal"); ax.axis("off")
    save(fig, "04a-pie")


def fig_ranked_bar():
    fig, ax = plt.subplots(figsize=(3.5, 2.7))
    labels = ["Transport", "Travel", "Business", "Financial", "Insurance",
              "Telecom", "Construction", "Personal"]
    vals = [21, 19, 17, 14, 11, 8, 6, 4]
    y = np.arange(len(vals))[::-1]
    ax.barh(y, vals, color=BLUE, height=0.62)
    for yi, v in zip(y, vals):
        ax.text(v + 0.5, yi, "%d" % v, va="center", fontsize=8.5, color=MUTED)
    ax.set_yticks(y); ax.set_yticklabels(labels, fontsize=8.5, color=INK)
    ax.set_xticks([])
    for s in ("top", "right", "bottom", "left"):
        ax.spines[s].set_visible(False)
    ax.tick_params(length=0); ax.set_xlim(0, 25)
    save(fig, "04b-ranked-bar")


def fig_donut():
    fig, ax = plt.subplots(figsize=(3.2, 2.7))
    labels = ["Transport", "Travel", "Business services", "Other"]
    vals = [38, 27, 21, 14]
    wedges, _ = ax.pie(vals, colors=[BLUE, YELLOW, DARKBLUE, WARM_GREY],
                       startangle=90, counterclock=False,
                       wedgeprops=dict(width=0.36, linewidth=1.6, edgecolor="white"))
    ax.text(0, 0.10, "1.6", ha="center", va="center", fontsize=20,
            color=INK, fontweight="bold")
    ax.text(0, -0.22, "trillion dollars", ha="center", va="center",
            fontsize=8, color=MUTED)
    for w, lab, v in zip(wedges, labels, vals):
        ang = (w.theta1 + w.theta2) / 2
        xr, yr = np.cos(np.deg2rad(ang)), np.sin(np.deg2rad(ang))
        ax.text(xr * 1.18, yr * 1.18, "%s\n%d%%" % (lab, v),
                ha="center" if abs(xr) < 0.4 else ("left" if xr > 0 else "right"),
                va="center", fontsize=7.6, color=INK, linespacing=1.35)
    ax.set_xlim(-1.9, 1.9); ax.set_ylim(-1.5, 1.5)
    ax.set_aspect("equal"); ax.axis("off")
    save(fig, "04c-donut")


def fig_truncated(zero):
    fig, ax = plt.subplots(figsize=(3.6, 2.4))
    ax.bar(["2020", "2021", "2022", "2023", "2024"], [96, 98, 101, 103, 106],
           color=BLUE if zero else YELLOW, width=0.6)
    frame(ax); ax.set_ylim(0 if zero else 94, 120 if zero else 108)
    save(fig, "05b-zero-baseline" if zero else "05a-truncated-axis")


def fig_dual_axis():
    fig, ax = plt.subplots(figsize=(4.6, 2.4))
    ax.plot(YEARS, series(120, 0.05, 0.01, 21), color=BLUE, linewidth=2.4)
    ax.set_ylabel("Exports, billions", color=BLUE, fontsize=8)
    ax2 = ax.twinx()
    ax2.plot(YEARS, series(4200, 0.02, 0.012, 22), color=YELLOW, linewidth=2.4)
    ax2.set_ylabel("Employment, thousands", color=OCHRE, fontsize=8)
    ax.spines["top"].set_visible(False); ax2.spines["top"].set_visible(False)
    ax.tick_params(length=0, labelsize=8); ax2.tick_params(length=0, labelsize=8)
    ax.set_xlim(2010, 2024); years_axis(ax)
    save(fig, "06a-dual-axis")


def fig_indexed():
    fig, ax = plt.subplots(figsize=(4.6, 2.4))
    a, b = series(120, 0.05, 0.01, 21), series(4200, 0.02, 0.012, 22)
    ax.plot(YEARS, a / a[0] * 100, color=BLUE, linewidth=LW, solid_capstyle="round")
    ax.plot(YEARS, b / b[0] * 100, color=YELLOW, linewidth=LW, solid_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(80, 240)
    ax.set_yticks([80, 120, 160, 200, 240]); years_axis(ax)
    top_legend(ax, [("Exports", BLUE, "-"), ("Employment", YELLOW, "-")])
    save(fig, "06b-indexed")


def fig_types():
    fig, axes = plt.subplots(1, 4, figsize=(7.4, 1.55))
    a, b, c, d = axes
    a.plot(YEARS, series(50, 0.04, 0.012, 31), color=BLUE, linewidth=2.6)
    a.set_title("Change over time", fontsize=8, color=INK, pad=6)
    cats = ["A", "B", "C", "D", "E"]
    b.bar(cats, [8, 14, 11, 17, 6], color=BLUE, width=0.6)
    b.set_title("Compare categories", fontsize=8, color=INK, pad=6)
    y = np.arange(5)[::-1]
    c.barh(y, [17, 14, 11, 8, 6], color=BLUE, height=0.6); c.set_yticks([])
    c.set_title("Rank", fontsize=8, color=INK, pad=6)
    bottom = np.zeros(5)
    for col, v in zip([BLUE, YELLOW, DARKBLUE],
                      [[5, 6, 6, 7, 8], [4, 4, 5, 5, 5], [3, 3, 3, 4, 4]]):
        d.bar(cats, v, bottom=bottom, color=col, width=0.6); bottom += np.array(v)
    d.set_title("Composition", fontsize=8, color=INK, pad=6)
    for ax in axes:
        frame(ax); ax.set_xticks([]); ax.set_yticks([])
        ax.spines["bottom"].set_visible(False); ax.yaxis.grid(False)
    save(fig, "07-chart-types")


def fig_axis_max(good):
    fig, ax = plt.subplots(figsize=(3.6, 2.4))
    v = series(100, 0.049, 0.010, 55)
    v = v / v[-1] * 195
    ax.plot(YEARS, v, color=BLUE, linewidth=LW, solid_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024)
    if good:
        ax.set_ylim(0, 200); ax.set_yticks([0, 50, 100, 150, 200])
    else:
        ax.set_ylim(0, 360); ax.set_yticks([0, 60, 120, 180, 240, 300, 360])
    years_axis(ax)
    save(fig, "08b-axis-max-good" if good else "08a-axis-max-empty")


def fig_line_style():
    fig, ax = plt.subplots(figsize=(5.1, 2.4))
    v = series(100, 0.045, 0.010, 71)
    ax.plot(YEARS[:11], v[:11], color=BLUE, linewidth=LW, solid_capstyle="round")
    ax.plot(YEARS[10:], v[10:], color=BLUE, linewidth=LW,
            linestyle=(0, (1.5, 1.5)), dash_capstyle="round")
    frame(ax); ax.set_xlim(2010, 2024); ax.set_ylim(0, 200)
    ax.set_yticks([0, 50, 100, 150, 200]); years_axis(ax)
    top_legend(ax, [("Observed", BLUE, "-"), ("Estimated", BLUE, (0, (1.5, 1.5)))])
    save(fig, "09-line-style")


if __name__ == "__main__":
    fig_order(); fig_too_many(); fig_grouped(); fig_highlight()
    fig_pie(); fig_ranked_bar(); fig_donut()
    fig_truncated(False); fig_truncated(True)
    fig_dual_axis(); fig_indexed(); fig_types()
    fig_axis_max(False); fig_axis_max(True); fig_line_style()
