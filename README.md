# un-init-project

Six things live in this repo:

1. **`un-init-project`**, a CLI that scaffolds new UNCTAD data visualisation projects from a template.
2. **`packages/`**, an npm workspaces monorepo of shared code (`@unctad-infovis/*`) that scaffolded projects – and any project you build by hand – depend on instead of copy-pasting components.
3. **`un-audit-project`**, a CLI that recursively audits, updates, rebuilds and syncs already-scaffolded projects.
4. **`un-upload-documents`** + `/upload-documents`, a CLI and Claude Code skill that logs official documents (sessional documents, restricted documents, publications) from a gDoc2.0 email to Drupal – unrelated to the data-viz tooling above, but lives here as the CER Web Unit's third piece of shared automation.
5. **`un-create-datawrapper-chart`** + `/create-datawrapper-chart`, a CLI and Claude Code skill that builds UNCTAD-compliant Datawrapper charts – either from a CSV (`create`), or by copying an existing print/Publications chart to the web theme (`to-web`, source chart always left untouched) – with theme, locale, palette, country-group colours, and text-convention fixes applied automatically. The CLI/API path never publishes (the shared API token has no publish scope); the skill covers publishing via an authenticated browser session and logging the result as Drupal "Datawrapper" media, both only when explicitly asked.
6. **`un-compress-pdf`**, a CLI (and `compressPdf()` library function) that shrinks a PDF's embedded images via Ghostscript while leaving text/vectors untouched – ported from a standalone `compress-pdf.sh` tool. `un-upload-documents` calls this automatically on every PDF it stages, before editing its metadata (compression must come first – Ghostscript regenerates the PDF and always overwrites `/Producer`/`/Creator`, which would otherwise silently replace the original values `un-upload-documents` is careful to preserve).

If you're starting a new project, use the CLI. If you're wondering how a scaffolded project actually works (why it imports `@unctad-infovis/general-tools`, why images resolve differently in dev vs production, how to deploy), read on.

## Scaffolding a new project

`UN_PATH` needs to be set — this is the base path where the project folder is created.

```
export UN_PATH=''
```

Install once:

```
npm install && npm install -g
```

Then:

```
un-init-project {project_name} [template_name]
```

Default template is `react-vite`. Example: `un-init-project 2026-climate`

### Available templates

- **react-vite** — plain React + Vite, build everything from zero.
- **react-vite-highcharts-map** — React + Vite, pre-wired for a Highcharts map visualisation based on the UN country map.
- `react-webpack*` — deprecated, do not use.

## The `@unctad-infovis/*` packages

| Package | What it's for |
|---|---|
| `general-tools` | Shared React components (`ButtonAnchor`, `ButtonShare`, `ChartDataWrapper`, `CircleFlag`, `Image`, `ProgressBar`, `Quote`, `RollingNumber`, `Select`, `Tooltip`, `UNCTADSiteHeader`, `BackToTop`), helpers (`BasePath`/`resolveAsset`, `LoadFile`, `CsvToJson`, `FormatNr`, `RoundNr`, `UseIsVisible`, `UseClickOutside`, `UseCountUp`) and base design-token styles (`colors.css`, `basics.css`, `styles.css`). |
| `minisite-tools` | Report/minisite layout components (`Header`, `HeaderChapter`, `Footer`, `SideScrollingText`). More project-specific than `general-tools` — check whether a project's actual content differs from the package defaults before assuming it's a safe drop-in (see [Reusing vs. forking a component](#reusing-vs-forking-a-shared-component)). |
| `map-tools` | Highcharts map helpers: TopoJSON processing (`ProcessTopoObject`, `ProcessTopoObjectPolygons`), disputed-territory colour resolution (`GetColor`, `GetValue`), border/mapline series (`CreateMaplineSeries`), and `styles.css` for Highcharts button/tooltip chrome. |
| `unctad-flags` | Round country/region flag SVGs. Not bundled into your project — see [Hosted assets](#hosted-assets-unctad-flags-and-unctad-icons). |
| `unctad-icons` | UNCTAD-branded icons (site header preview images, quote/download/eye icons, report bullet arrow). Also hosted, not bundled. |

A project consumes these the same way as any npm dependency:

```js
import ButtonShare from '@unctad-infovis/general-tools/components/ButtonShare.jsx';
import loadFile from '@unctad-infovis/general-tools/helpers/LoadFile.js';
import '@unctad-infovis/general-tools/styles/styles.css';
```

### Registry setup

Packages publish to GitHub Packages, not the public npm registry. Each consuming project needs a project-local `.npmrc` (committed — it contains no secret, just an env-var reference):

```
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
@unctad-infovis:registry=https://npm.pkg.github.com
```

`GITHUB_PACKAGES_TOKEN` (a classic PAT with `read:packages`, and `write:packages` if you're publishing) must be set in your shell environment — never commit the actual token.

### Publishing a package change

From this repo's root:

```
npm version patch|minor -w packages/<package-name>   # bump
GITHUB_PACKAGES_TOKEN=$GITHUB_PACKAGES_TOKEN npm publish -w packages/<package-name>
```

Then in each consuming project, bump the dependency version in `package.json` and `npm install`.

### Reusing vs. forking a shared component

Before adding a new local component to a project, check whether `general-tools`/`minisite-tools`/`map-tools` already has it. If a project needs something close-but-not-quite what the package provides:

- **The difference is a bug fix, or the package version is objectively more correct** (e.g. it now supports `prefers-reduced-motion` and the local copy doesn't) — adopt the package, don't fork.
- **The difference is a genuine design/content choice** (e.g. one report's `Footer` has real content links, another's has different ones; one project wants a 3-tier responsive `h3` scale, the package only has one breakpoint) — keep the project-local override, but scope it tightly using the project's own root ID so it reliably wins over the package's `.app`-scoped styles:

  ```css
  #app-root-<project_name> .app {
    /* only the properties that genuinely differ from the package */
  }
  ```

  Don't fork the whole component/file for a one-property difference — diff against the package version first and only override what's actually different.
- **The difference is reusable by more than one project** (as happened repeatedly while cleaning up the 11 example projects below) — upstream it into the shared package instead of leaving it duplicated.

## Environment-aware asset resolution

Every deployed project can run from three different origins: `localhost` during development, `unctad-infovis.github.io/<project>` on gh-pages, or `storage.unctad.org/<project>` in production. `general-tools/helpers/BasePath.js` resolves the correct base URL:

```js
import basePath, { resolveAsset } from '@unctad-infovis/general-tools/helpers/BasePath.js';

resolveAsset('assets/img/hero.jpg'); // -> correct absolute/relative URL for wherever this is running
```

Use `resolveAsset()` (or `basePath() + 'relative/path'`) for any project-local image referenced from JS. It cannot be used from CSS `url()` — CSS is static, so per-project background images referenced in CSS should be relative paths that Vite bundles normally.

### Hosted assets: `unctad-flags` and `unctad-icons`

Flags and UNCTAD-branded icons are used by many projects (`CircleFlag`, `UNCTADSiteHeader`, `ButtonAnchor`, `Quote`), so bundling them per-project means the same ~450 files get duplicated across every consumer's git history and build output. Two things were tried and rejected before landing on the current approach:

1. Duplicating the files into each project's `public/` folder — works, but is exactly the duplication problem this was meant to solve.
2. Bundling via Vite's `import.meta.glob()` — technically works, but Vite inlines small assets as base64 into the JS bundle regardless of how many are actually used on a given page, growing a typical bundle by 3-4x for no benefit.

Instead, `unctad-flags` and `unctad-icons` export a URL resolver, not the files themselves:

```js
import { getFlagUrl } from '@unctad-infovis/unctad-flags';
getFlagUrl('fr'); // -> hosted URL, resolved per-environment

import { getIconUrl } from '@unctad-infovis/unctad-icons';
getIconUrl('unctad_site_header_logo.png');
```

On `unctad.org` these resolve to `storage.unctad.org/shared-resources/flags/round/` and `storage.unctad.org/shared-resources/icons/`; everywhere else (dev, gh-pages) they resolve to this repo's raw GitHub content (this repo is public, so no auth is needed to fetch from it). The files stay as plain, browser-cached `<img>` requests — nothing is bundled.

If you add or change a file in `packages/unctad-flags/src/round/` or `packages/unctad-icons/src/`, sync it to production storage:

```
npm run sync-flags     # packages/unctad-flags/src/round -> storage.unctad.org/shared-resources/flags/round
npm run sync-icons     # packages/unctad-icons/src -> storage.unctad.org/shared-resources/icons
npm run sync-shared-resources   # both
```

(Needs `az`/`azcopy` authenticated against the storage account — run `npm run login` first if it fails with an auth error.)

A few CSS-embedded icons (`ButtonAnchor.css`, `Quote.css`) reference the `storage.unctad.org` URL directly rather than through the resolver, since CSS `url()` can't call a JS function to branch per-environment. This means those specific icons won't render on `localhost` until the initial sync has happened at least once — acceptable since they rarely change.

## Deploying a project

Every scaffolded project has the same deploy scripts:

```
npm run build           # vite build + postbuild (rewrites absolute paths to relative, versions asset URLs)
git push && git push unctad main   # both GitHub and the Azure DevOps mirror
npm run sync-gh-pages   # git subtree push --prefix dist origin gh-pages
npm run sync-prod       # azcopy dist/ -> storage.unctad.org/<project>/
```

`dist/` is committed to git in most projects (needed for `sync-gh-pages`'s subtree push to work) — check an individual project's convention before assuming otherwise.

## Auditing and updating existing projects

`un-audit-project <path>` walks every scaffolded project under `<path>` (or audits a single project directly) and, per project: skips it if the git working tree isn't clean, runs `npm update` + `npm audit fix`, rebuilds only if dependencies changed, diffs the build output against `HEAD`, and commits + pushes (`--no-push` to skip) whatever actually changed. If the production JS/CSS changed, it also runs `npm run sync-prod`.

```
un-audit-project <path>                    # audit one project, or every project found recursively
un-audit-project <path> --dry-run          # report only, apply nothing
un-audit-project <path> --no-push          # commit locally, skip git push and sync-prod
un-audit-project <path> --skip-sync-prod   # do everything except the azcopy upload
```

Drop a `.un-audit-ignore` file (any content) in a project's root to exclude it from discovery — useful for internal/demo projects. Run history is kept in `~/.un-audit-project/state.json`, keyed by project path.

## Logging official documents to Drupal

CER's Web Unit receives official UN documents (sessional documents,
restricted documents, publications) by email from gDoc2.0/Doc Submission
and has to rename them per UN symbol convention, edit their PDF metadata,
file them under the team OneDrive, and log them in Drupal as "Official
Document" content. `un-upload-documents` automates the mechanical half of
that job (orchestration lives in `src/upload-pipeline.js`; `bin/upload-
documents.js` is a thin CLI wrapper around it, same pattern as `un-audit-
project`); the `/upload-documents` Claude Code skill (`.claude/skills/
upload-documents/SKILL.md`) drives the rest, including the Drupal upload
itself via browser automation.

```
un-upload-documents <email-file> <attachment-path> [--out <dir>] [--root <onedrive-root>] [--dry-run]
```

Given the forwarded gDoc2.0 notification email and its attachment (a single
PDF, a directory of PDFs, or the "final documents" zip gDoc2.0 sends), it:

- classifies the document (Publication / Sessional Document / Restricted / CRP),
- computes the correct filename and OneDrive destination folder – per the
  real, current convention verified against actual files already on
  OneDrive, not just the written guideline text (see `src/doc-naming.js`
  for exactly which symbol shapes are high-confidence vs. best-effort),
- compresses each staged PDF's embedded images via `un-compress-pdf`
  (Ghostscript, `ebook` quality) before editing its metadata – text and
  vectors untouched, but a print-resolution PDF often shrinks by 80%+,
- applies UNCTAD's PDF metadata conventions (Title/Author/Subject/Keywords/
  Language, print presets, Initial View) for English, French and Spanish,
- generates a cover JPG for publications (skipped for sessional documents),
  and surfaces taxonomy candidates for both – the large general Thematic
  Taxonomy list for publications, or a small curated Product Taxonomy list
  for sessional documents (pick up to 5, by reading the document),
- files everything under `!MASTER_DOCS_and_PUB` on OneDrive, and
- writes a JSON manifest – including copy-paste-ready EN/FR/ES titles –
  for the skill (or a human) to review before anything touches Drupal.

It never silently overwrites an existing OneDrive file, and it never
touches Drupal itself – that's the skill's job, gated on the user already
being logged into `uat-unctad.org` (never production, unless told
otherwise) and on explicit confirmation before the final Save.

The taxonomy lists this tool suggests from are checked in at
`data/Thematic_Taxonomy_List.txt` (publications) and
`data/Sessional_Document_Product_Taxonomy.txt` (sessional documents). The
three source guideline PDFs and
reference AI PDF-prep instructions this was built from are local reference
material only (`tmp/`, gitignored) – not needed to run the tool, just useful
if you're changing how it behaves.

`un-upload-documents` also accepts a real Outlook `.eml` export directly –
`un-upload-documents <email>.eml [--out <dir>]` – and will pull both the
email body and its zip/PDF attachment straight out of the `.eml`, so a
second attachment-path argument isn't needed in that case.

## Making a first-draft Datawrapper chart

Every UNCTAD web chart currently gets made by hand in the Datawrapper
editor, then reviewed – and most of what that review fixes is mechanical:
wrong locale/theme, axis labels left on automatic, a differently-phrased
source line, palette order off. `un-create-datawrapper-chart` takes a CSV
and a few flags and creates a **draft** chart via the Datawrapper API with
those settings already correct, so a human only has to judge the two
things that actually need judgment: is this the right chart type, and does
the title state the right finding. It never publishes – that stays a
manual step in the Datawrapper editor.

```
un-create-datawrapper-chart check <data.csv> [--json]
un-create-datawrapper-chart create <data.csv> --type <id> --title <t> --description <d> --source <s>
  [--source-url <url>] [--notes <text>] [--folder <id>] [--highlight <series>] [--other <series>]
  [--print] [--strict] [--dry-run] [--json]
```

`check` reads a CSV and, with no API call and no token needed, reports
column types, data problems (thousands separators, `n/a`/`..`
placeholders, blank rows, duplicate/empty headers), and a recommended
chart type with a one-line reason – this is what to run first.

`create` validates the CSV and the title/description/source text against
UNCTAD's own conventions (figure numbering, missing verbs, abbreviations
not spelled out first, em dashes, the four source-line templates – see
`src/datawrapper-validate.js`), assigns the UN palette in the fixed order
(with `--highlight`/`--other` support and the "more than 6 series" error /
"5–6 series" warning), then creates the chart, uploads the data, and
patches the metadata with all 11 settings from
`src/datawrapper-constants.js`. `--dry-run` prints the exact payloads
without calling the API at all. Chart types currently supported:
`d3-lines`, `column-chart`, `d3-bars` – anything else, including any map
type, is rejected with a clear message before any network call.

The API token lives outside the repo, at `~/.un-datawrapper/config.json`
(`{"apiToken": "..."}`) – never as an env var, never committed, never
logged. New charts default to UNCTAD's `437477` Datawrapper folder unless
`--folder` overrides it.

Deferred, not built yet: `lint`, `apply-settings`, `publish`, `export`,
and support for chart types beyond the three above (which need a real
created chart's `GET /v3/charts/{id}` response to verify the metadata
shape against first – see `TODO.md`). A reference Python script for two
other chart types lives at `tmp/create_datawrapper_charts.py` if extending
this further.

### Turning a print chart into a web chart

```
un-create-datawrapper-chart to-web <sourceChartId> [--folder <id>] [--dry-run] [--json]
```

Copies an existing chart (`POST /charts/{id}/copy` – the source is never
edited) and converts the copy to the web theme: text fields cleaned of
print-era inline HTML, hyphens between years turned into en dashes,
country-group series (developed/developing/LDCs/SIDS) recoloured to the UN
palette and their abbreviations opened up, custom ticks cleared, y-axis
labels forced inside. See `.claude/skills/create-datawrapper-chart/
SKILL.md` for the full workflow this is one step of – finding the right
source chart from a content brief, publishing (which needs a browser
session, not this CLI – the API token has no publish scope), and logging
the result as a Drupal "Datawrapper" media item.
