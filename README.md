# un-init-project

Two things live in this repo:

1. **`un-init-project`**, a CLI that scaffolds new UNCTAD data visualisation projects from a template.
2. **`packages/`**, an npm workspaces monorepo of shared code (`@unctad-infovis/*`) that scaffolded projects — and any project you build by hand — depend on instead of copy-pasting components.

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
