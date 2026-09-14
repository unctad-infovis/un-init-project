import fs from 'node:fs';

import { inspectCsv, detectMissingHeaderRow } from './csv-inspect.js';
import { validateChartText } from './datawrapper-validate.js';
import {
  buildChartMetadata, buildLineStyles, stripHtml, normalizeSourceLine,
  buildCountryGroupLabelOverrides,
} from './datawrapper-metadata.js';
import {
  isMapChartType, SUPPORTED_CHART_TYPES, DEFAULT_ORGANIZATION_ID, DEFAULT_FOLDER_ID,
  THEME_WEB, THEME_PRINT, LOCALE, buildBaseMetadata, resolveCountryGroupColors, resolveYearPairColors,
} from './datawrapper-constants.js';
import { loadApiToken } from './datawrapper-config.js';
import { createChart, uploadData, patchMetadata, getChart, copyChart } from './datawrapper-api.js';

/** A user-facing failure (bad input, failed validation) – the caller should print `.message` plainly, no stack trace. */
export class CreateChartError extends Error {}

export function runCheckPipeline(csvPath) {
  return inspectCsv(csvPath);
}

/**
 * Validate + build the chart payloads, then (unless `dryRun`) actually
 * call the Datawrapper API: create the draft, upload the data, patch the
 * metadata. Never calls `/publish` – that's a separate, explicit command
 * this tool doesn't implement yet (see TODO.md).
 *
 * @param {object} options
 * @param {string} options.csvPath
 * @param {string} options.type - Datawrapper chart type id
 * @param {string} options.title
 * @param {string} options.description
 * @param {string} options.source
 * @param {string} [options.sourceUrl]
 * @param {string} [options.notes]
 * @param {string} [options.folderId] - defaults to DEFAULT_FOLDER_ID
 * @param {string} [options.highlight] - series name to colour; all others become pale grey
 * @param {string} [options.other] - series name to treat as the grouped "Other" (warm grey)
 * @param {boolean} [options.print] - use the Publications theme instead of the web theme
 * @param {boolean} [options.strict] - promote text-validation warnings to errors
 * @param {boolean} [options.dryRun] - validate and build payloads without calling the API
 */
export async function runCreatePipeline({
  csvPath, type, title, description, source, sourceUrl, notes,
  folderId, highlight, other, print = false, strict = false, dryRun = false,
}) {
  // Fail fast on chart type, before any file I/O.
  if (isMapChartType(type)) {
    throw new CreateChartError(`"${type}" is a map chart type – UNCTAD does not publish Datawrapper maps, because the boundaries don't follow UN cartographic conventions.`);
  }
  if (!SUPPORTED_CHART_TYPES.includes(type)) {
    throw new CreateChartError(`"${type}" isn't supported yet – this tool currently builds metadata for ${SUPPORTED_CHART_TYPES.join(', ')} only. Run "check" for a recommendation.`);
  }

  const csvReport = inspectCsv(csvPath);
  if (csvReport.rowCount === 0) {
    throw new CreateChartError(`"${csvPath}" has a header row but no data rows.`);
  }
  const missingHeaderProblem = detectMissingHeaderRow(csvReport.header);
  if (missingHeaderProblem) {
    throw new CreateChartError(missingHeaderProblem);
  }
  const seriesNames = csvReport.header.slice(1);
  if (seriesNames.length === 0) {
    throw new CreateChartError(`"${csvPath}" has only one column – nothing to plot alongside it.`);
  }

  const textFindings = validateChartText({ title, description, source, notes });
  const blocking = textFindings.filter((f) => f.severity === 'error' || (strict && f.severity === 'warning'));
  if (blocking.length > 0) {
    const list = blocking.map((f) => `${f.field}: ${f.message}`).join('\n  ');
    throw new CreateChartError(`Text validation failed:\n  ${list}`);
  }

  const { theme, language, metadata, palette } = buildChartMetadata({
    type, print, description, source, sourceUrl, notes, seriesNames, highlight, other,
  });
  if (palette.errors.length > 0) {
    throw new CreateChartError(`Palette assignment failed:\n  ${palette.errors.join('\n  ')}`);
  }

  const resolvedFolderId = folderId || DEFAULT_FOLDER_ID;
  const result = { csvReport, textFindings, theme, language, metadata, palette, folderId: resolvedFolderId, dryRun, chartId: null, editorUrl: null };
  if (dryRun) return result;

  const token = loadApiToken();
  const chartId = await createChart({
    token, title, type, theme, language,
    folderId: resolvedFolderId,
    organizationId: DEFAULT_ORGANIZATION_ID,
  });

  const csvText = fs.readFileSync(csvPath, 'utf8');
  await uploadData({ token, chartId, csvText });
  await patchMetadata({ token, chartId, metadata, theme, language });

  result.chartId = chartId;
  result.editorUrl = `https://app.datawrapper.de/chart/${chartId}/visualize`;
  return result;
}

/**
 * Turn an existing print/Publications chart into a new web/social-media
 * chart, in the default (or `--folder`) folder – for the common case of a
 * chart already made for a PDF publication that also needs a web version.
 *
 * Deliberately a *copy*, not an edit of the original: `POST /charts/{id}
 * /copy` clones the existing chart's data, colours, axes and describe
 * text untouched (those were already deliberately chosen for that chart),
 * then this only patches the settings that actually differ between the
 * print and web themes – theme itself, the publish blocks (logo/download,
 * absent on print), sharing, and `y-grid-labels`. For `d3-lines` charts it
 * also re-applies this tool's own line-width/legend rules (see
 * `buildLineStyles`) to the copy's existing series names, since a
 * print-only chart was never run through `create` and so never got them –
 * but keeps the original's own colour assignment rather than reassigning
 * from the palette.
 *
 * @param {object} options
 * @param {string} options.sourceChartId
 * @param {string} [options.folderId] - defaults to DEFAULT_FOLDER_ID
 * @param {boolean} [options.dryRun] - fetch and report the plan without copying/patching anything
 */
export async function runConvertToWebPipeline({ sourceChartId, folderId, dryRun = false }) {
  const token = loadApiToken();
  const source = await getChart({ token, chartId: sourceChartId });

  const warnings = [];
  if (source.theme === THEME_WEB) {
    warnings.push(`Source chart is already using the "${THEME_WEB}" (web) theme, not "${THEME_PRINT}" – converting it again is harmless but may not be necessary.`);
  }

  const webBase = buildBaseMetadata({ print: false });
  const overlayMetadata = {
    publish: { blocks: webBase.metadata.publish.blocks },
    visualize: {
      sharing: webBase.metadata.visualize.sharing,
      'y-grid-labels': webBase.metadata.visualize['y-grid-labels'],
    },
  };

  if (source.type === 'd3-lines') {
    // A computed column (describe['computed-columns'], e.g. a formula
    // series like "All cross-regional" derived from other columns at
    // render time) is a real line on the chart but was never a key in
    // color-category.map – confirmed 2026-09-14 on a real chart (FiT2J):
    // one such line was silently skipped by buildLineStyles below,
    // leaving it without colorKey/directLabel set at all and so it fell
    // back to Datawrapper's own default (next-to-line label), the one
    // thing this whole block exists to prevent. Always include computed
    // columns alongside the map's own keys.
    const computedColumnNames = (source.metadata?.describe?.['computed-columns'] ?? []).map((c) => c.name);
    // A genuinely single-series d3-lines chart has no reason to have ever
    // gotten a color-category.map at all (nothing to assign distinct
    // colours between) – confirmed 2026-09-14 on a real chart (QeVNv,
    // one line, "Real income per capita"): color-category.map was `{}`,
    // so existingSeriesNames came back empty and buildLineStyles below
    // never ran, silently leaving the print chart's own thin dashed line
    // style untouched on the web copy instead of UNCTAD's thick solid
    // line convention. visualize.lines' own keys are the one source that
    // always has every real series, map or no map – always included.
    const existingSeriesNames = [
      ...new Set([
        ...Object.keys(source.metadata?.visualize?.['color-category']?.map ?? {}),
        ...computedColumnNames,
        ...Object.keys(source.metadata?.visualize?.lines ?? {}),
      ]),
    ];
    if (existingSeriesNames.length > 0) {
      overlayMetadata.visualize.lines = buildLineStyles(existingSeriesNames);
      // Carry forward each line's own custom title (Datawrapper falls back
      // to the raw series/column name when none is set, which is fine as-
      // is) – but strip it of the print chart's inline HTML span first
      // (e.g. `<span style="font-size:14px;">Developed<span>`, often with
      // the closing tag malformed too). Confirmed 2026-09-03: buildLineStyles
      // itself never sets a title, so without this every line on a
      // converted web chart silently kept its print-era HTML forever.
      const existingLines = source.metadata?.visualize?.lines ?? {};
      for (const name of existingSeriesNames) {
        const rawTitle = existingLines[name]?.title;
        if (!rawTitle) continue;
        const cleanTitle = stripHtml(rawTitle);
        if (cleanTitle) overlayMetadata.visualize.lines[name].title = cleanTitle;
      }
    } else {
      warnings.push('Source is a d3-lines chart but has no visualize.color-category.map – skipped applying line-width/legend rules.');
    }
  }

  // Country-group colour rule (developed=blue, developing=yellow, SIDS=
  // dark blue, LDCs=dark yellow, always) – confirmed 2026-09-04, see
  // classifyCountryGroup's own comment in datawrapper-constants.js.
  // Applies to whichever field actually holds the series→colour map for
  // this chart type. When no series in the map is a recognised country
  // group at all, try the narrower year-pair rule instead (resolveYearPair
  // Colors is a no-op unless the map is *exactly* two bare 4-digit years)
  // – the two rules are mutually exclusive by construction, never both
  // relevant to the same chart.
  const sourceColorMap = source.metadata?.visualize?.['color-category']?.map;
  if (sourceColorMap && Object.keys(sourceColorMap).length > 0) {
    let correctedColors = resolveCountryGroupColors(sourceColorMap);
    if (JSON.stringify(correctedColors) === JSON.stringify(sourceColorMap)) {
      correctedColors = resolveYearPairColors(sourceColorMap);
    }
    if (JSON.stringify(correctedColors) !== JSON.stringify(sourceColorMap)) {
      overlayMetadata.visualize['color-category'] = {
        ...source.metadata.visualize['color-category'],
        map: correctedColors,
      };
      // The map alone is silently ignored unless the chart is actually
      // set to colour its series by column – confirmed 2026-09-04, a
      // real colour-category patch had no visible effect until this was
      // also set. Only touched when the source has the field at all
      // (some chart types, e.g. d3-lines, don't use it and colour
      // straight from color-category.map instead).
      if (source.metadata?.visualize?.['color-by-column'] !== undefined) {
        overlayMetadata.visualize['color-by-column'] = true;
      }
    }
    // "LDC(s)"/"SIDS" must never appear bare in a legend – opened up to
    // their full names. d3-lines stores the display label per-series under
    // visualize.lines.<name>.title (also stripped of the print chart's own
    // inline HTML span, e.g. `<span style="font-size:14px;">LDC<span>`);
    // every other chart type uses the shared color-category.categoryLabels
    // override instead.
    const labelOverrides = buildCountryGroupLabelOverrides(Object.keys(sourceColorMap));
    if (Object.keys(labelOverrides).length > 0) {
      if (source.type === 'd3-lines') {
        overlayMetadata.visualize.lines = overlayMetadata.visualize.lines ?? buildLineStyles(Object.keys(sourceColorMap));
        for (const [name, label] of Object.entries(labelOverrides)) {
          overlayMetadata.visualize.lines[name] = { ...overlayMetadata.visualize.lines[name], title: label };
        }
      } else {
        overlayMetadata.visualize['color-category'] = {
          ...overlayMetadata.visualize['color-category'],
          ...source.metadata.visualize['color-category'],
          map: overlayMetadata.visualize['color-category']?.map ?? sourceColorMap,
          categoryLabels: { ...source.metadata.visualize['color-category']?.categoryLabels, ...labelOverrides },
        };
      }
    }
  }

  // Custom tick values are print-layout leftovers that shouldn't carry
  // over to a web chart – confirmed 2026-09-03. Always cleared, regardless
  // of whether the source chart happened to have any set.
  overlayMetadata.visualize['custom-ticks'] = '';
  overlayMetadata.visualize['custom-ticks-x'] = '';
  overlayMetadata.visualize['custom-ticks-y'] = '';

  // Y-axis tick/value labels sit inside the plot area, matching the
  // y-grid-labels:'inside' rule above – confirmed 2026-09-03 against a
  // real chart (kqCGe) whose yAxisLabels.placement had drifted to
  // 'outside'. Only patched when the chart type actually has this field.
  if (source.metadata?.visualize?.yAxisLabels) {
    overlayMetadata.visualize.yAxisLabels = { ...source.metadata.visualize.yAxisLabels, placement: 'inside' };
  }

  // Bar-chart-family defaults, confirmed 2026-09-04 on a real grouped-bar
  // chart (xxjf3) – each only touched when the source chart type actually
  // has the field, so this is a no-op on chart types without it (e.g.
  // d3-lines, which has none of these):
  // - never auto-sort bars by value – the row order is meaningful
  //   (usually category order from the data), not something to reshuffle.
  // - value labels sit to the right of their bar, not the left.
  if (source.metadata?.visualize?.['sort-bars'] !== undefined) {
    overlayMetadata.visualize['sort-bars'] = false;
  }
  if (source.metadata?.visualize?.['value-label-alignment'] !== undefined) {
    overlayMetadata.visualize['value-label-alignment'] = 'right';
  }
  if (source.metadata?.visualize?.['label-alignment'] !== undefined) {
    overlayMetadata.visualize['label-alignment'] = 'right';
  }

  // Stacked-chart series labels default to a colour-key legend, never the
  // "direct" connector-line-to-each-segment style – confirmed 2026-09-04 on
  // a real stacked-column chart (DEkvW). The controlling field for that
  // choice is `categoryLabels.position` ('direct' -> 'color-key') alone –
  // gated on `stack-color-legend` existing on the source at all, since that
  // field is specific to chart types with this direct-vs-legend choice.
  //
  // `stack-color-legend` itself is a DIFFERENT, cosmetic toggle – corrected
  // 2026-09-08, found live-testing a real chart (KRN0n) via its "Stack
  // labels" checkbox: it only controls whether the resulting colour-key
  // legend renders as a stacked one-per-line list or a flowing/wrapped
  // inline list – it does not gate direct-vs-legend at all (confirmed by
  // toggling it alone with categoryLabels.position held at 'color-key' the
  // whole time – only the legend's own layout changed). Per the user
  // (2026-09-08): "the stack labels should NOT be enabled in most cases" –
  // so this is left false (flowing/wrapped), the opposite of what this
  // code forced to true before the correction.
  // `enabled` is forced explicitly rather than merely spread from the
  // source – confirmed 2026-09-14 on a real d3-lines chart (FiT2J,
  // converted from NyqiP): a bar-chart-family source chart's own
  // categoryLabels object had already picked up `enabled: true` at some
  // point in its own history, so spreading it looked like this worked –
  // but a d3-lines source with no categoryLabels object at all (the
  // common case, since buildLineStyles only ever sets the per-line
  // colorKey/directLabel flags, never this chart-level field) spread to
  // `{}` and left the legend never actually switched on, even though
  // `show-color-key`/`stack-color-legend` were both set "correctly".
  if (source.metadata?.visualize?.['stack-color-legend'] !== undefined) {
    overlayMetadata.visualize['stack-color-legend'] = false;
    overlayMetadata.visualize['show-color-key'] = true;
    overlayMetadata.visualize.categoryLabels = {
      ...source.metadata.visualize.categoryLabels,
      enabled: true,
      position: 'color-key',
    };
  }

  // Default gridlines – confirmed 2026-09-14 on the same real d3-lines
  // chart (FiT2J): its print-era source (NyqiP) had both axes' gridlines
  // off, which a genuinely print-only chart (never run through `create`,
  // same gap `buildLineStyles` above exists to cover) can carry forward
  // unnoticed. The one concrete "already correct" precedent seen so far
  // (a converted stacked-column chart whose print source already had
  // `y-grid: 'on'`) matches the standard convention for a value axis:
  // horizontal reference lines to read values off, no vertical lines
  // cluttering the category/time axis. Only touched when the chart type
  // actually has the field; x-grid is deliberately left alone.
  if (source.metadata?.visualize?.['y-grid'] !== undefined) {
    overlayMetadata.visualize['y-grid'] = 'on';
  }

  // Text fields always get cleaned up on conversion, per user instruction:
  // - Inline HTML styling (old print charts' `<span style="font-size:
  //   14px;">...</span>` wrapping) is stripped down to plain text.
  // - The source line always gets "UN Trade and Development (UNCTAD)"
  //   prefixed if it's missing, defaulting to a "based on" clause when no
  //   verb (calculations/estimates) is specified (see normalizeSourceLine).
  // - `hide-title` is always turned off for the web copy – a web chart
  //   should show its title.
  // - Common convention on older print charts (confirmed 2026-08-27):
  //   `hide-title: true` with the real, publicly-visible headline sitting
  //   in styled HTML inside `describe.intro` instead, and no separate
  //   description text at all. The (hidden, print-specific, often
  //   figure-numbered) title field can't be trusted as a ready-to-publish
  //   web title in that case, so it's replaced with an explicit "TITLE
  //   NEEDED" placeholder rather than silently carried over – and the
  //   cleaned intro text is demoted to its proper role as the subtitle/
  //   description instead of standing in as a fake title.
  // Some source charts were never actually titled – they still carry
  // Datawrapper's own new-chart placeholder text verbatim (e.g. the
  // French default "[ Insérez le titre ici ]", confirmed 2026-09-14 on a
  // real chart, h1CbZ). `stripHtml` only strips markup, so this is
  // non-empty and would otherwise pass straight through as if it were a
  // real, ready-to-publish title. A real UNCTAD chart title is never
  // literally wrapped in square brackets, so that shape alone is a safe
  // signal to treat as unset.
  const isPlaceholderTitle = (text) => /^\[.*\]$/.test((text ?? '').trim());
  const usesHiddenTitleConvention = source.metadata?.describe?.['hide-title'] === true;
  const cleanedSourceTitle = stripHtml(source.title);
  const finalTitle = usesHiddenTitleConvention || !cleanedSourceTitle || isPlaceholderTitle(cleanedSourceTitle) ? 'TITLE NEEDED' : cleanedSourceTitle;
  // Same mechanical fixes as the source line: collapse doubled spaces
  // (print charts sometimes have one from a deleted inline span) and turn
  // a hyphen between two years into an en dash – confirmed 2026-09-03 as
  // a general description-field issue, not just something source-name has.
  const finalIntro = stripHtml(source.metadata?.describe?.intro)
    .replace(/  +/g, ' ')
    .replace(/\b((?:1[89]|20)\d{2})-((?:1[89]|20)\d{2})\b/g, '$1–$2');
  const finalSourceLine = normalizeSourceLine(source.metadata?.describe?.['source-name']);

  if (finalTitle === 'TITLE NEEDED') {
    const reason = usesHiddenTitleConvention
      ? 'title field is hidden by hide-title, print-specific headline lives in intro instead'
      : isPlaceholderTitle(cleanedSourceTitle)
        ? 'title field still holds Datawrapper\'s own unfilled new-chart placeholder text'
        : 'title field is empty';
    warnings.push(`No usable web title on the source chart (${reason}) – set to the placeholder "TITLE NEEDED". Original title text: "${source.title || '(empty)'}".`);
  }

  overlayMetadata.describe = {
    intro: finalIntro,
    'source-name': finalSourceLine,
    'hide-title': false,
  };

  // The copy inherits annotate.notes verbatim from the source (copyChart
  // clones the whole chart) – old print charts' notes carry the same
  // inline-HTML styling as their titles/intros (e.g. `<span style=
  // "font-size:14px;">...<span>`, often with the closing tag malformed
  // too), so this needs its own explicit overlay rather than relying on
  // the copy to have already-clean text. Confirmed 2026-09-03.
  const rawNotes = source.metadata?.annotate?.notes;
  const finalNotes = stripHtml(rawNotes);
  if (rawNotes && finalNotes !== rawNotes.trim()) {
    overlayMetadata.annotate = { notes: finalNotes };
  }

  const textFindings = validateChartText({
    title: finalTitle === 'TITLE NEEDED' ? undefined : finalTitle,
    description: finalIntro,
    source: finalSourceLine,
    notes: finalNotes,
  });

  const resolvedFolderId = folderId || DEFAULT_FOLDER_ID;
  const result = {
    sourceChartId,
    sourceType: source.type,
    sourceTitle: source.title,
    sourceTheme: source.theme,
    resolvedFolderId,
    finalTitle,
    overlayMetadata,
    textFindings,
    warnings,
    dryRun,
    newChartId: null,
    editorUrl: null,
  };
  if (dryRun) return result;

  const newChartId = await copyChart({ token, chartId: sourceChartId });

  // Datawrapper's own /copy endpoint can regenerate a *richer*
  // color-category.map on the new copy than the source chart's stored
  // metadata actually shows (confirmed 2026-09-03: a real "multiple-
  // columns" copy came back with a "Developed" key its own source chart
  // didn't have, alongside "Developed economies"). The overlay above was
  // necessarily built from the source's map, so patching it back as-is
  // would silently drop whatever extra keys the fresh copy picked up –
  // re-resolve colours/labels against the copy's own live map instead of
  // trusting the source-derived one.
  if (overlayMetadata.visualize['color-category']) {
    const copy = await getChart({ token, chartId: newChartId });
    const copyColorMap = copy.metadata?.visualize?.['color-category']?.map;
    if (copyColorMap && Object.keys(copyColorMap).length > 0) {
      overlayMetadata.visualize['color-category'] = {
        ...copy.metadata.visualize['color-category'],
        ...overlayMetadata.visualize['color-category'],
        map: resolveCountryGroupColors(copyColorMap),
        categoryLabels: {
          ...copy.metadata.visualize['color-category'].categoryLabels,
          ...overlayMetadata.visualize['color-category'].categoryLabels,
        },
      };
    }
  }

  await patchMetadata({
    token, chartId: newChartId, metadata: overlayMetadata,
    theme: THEME_WEB, language: LOCALE, folderId: resolvedFolderId, title: finalTitle,
  });

  result.newChartId = newChartId;
  result.editorUrl = `https://app.datawrapper.de/chart/${newChartId}/visualize`;
  return result;
}
