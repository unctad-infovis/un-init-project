# The `@unctad-infovis/*` packages

`packages/` is an npm workspaces monorepo of shared code that scaffolded
projects – and any project you build by hand – depend on instead of
copy-pasting components. See the [root README](../README.md) for the rest
of this repo.

| Package | What it's for |
|---|---|
| `general-tools` | Shared React components (`ButtonAnchor`, `ButtonShare`, `ChartDataWrapper`, `CircleFlag`, `Image`, `ProgressBar`, `Quote` (incl. `variant="bar"`), `RollingNumber`, `Select`, `Tooltip`, `UNCTADSiteHeader`, `BackToTop`), helpers (`BasePath`/`resolveAsset`, `LoadFile`, `CsvToJson`, `FormatNr`, `RoundNr`, `UseIsVisible`, `UseClickOutside`, `UseCountUp`, `PinFallback`) and base design-token styles (`colors.css`, `basics.css`, `styles.css`). |
| `minisite-tools` | Report/minisite layout components (`Header`, `HeaderChapter`, `Footer`, `SideScrollingText`). More project-specific than `general-tools` — check whether a project's actual content differs from the package defaults before assuming it's a safe drop-in (see [Reusing vs. forking a shared component](#reusing-vs-forking-a-shared-component)). |
| `map-tools` | Highcharts map helpers: TopoJSON processing (`ProcessTopoObject`, `ProcessTopoObjectPolygons`), disputed-territory colour resolution (`GetColor`, `GetValue`), border/mapline series (`CreateMaplineSeries`), and `styles.css` for Highcharts button/tooltip chrome. |
| `unctad-flags` | Round country/region flag SVGs. Not bundled into your project — see [Hosted assets](assets.md#hosted-assets-unctad-flags-and-unctad-icons). |
| `unctad-icons` | UNCTAD-branded icons (site header preview images, quote/download/eye icons, report bullet arrow). Also hosted, not bundled. |

A project consumes these the same way as any npm dependency:

```js
import ButtonShare from '@unctad-infovis/general-tools/components/ButtonShare.jsx';
import loadFile from '@unctad-infovis/general-tools/helpers/LoadFile.js';
import '@unctad-infovis/general-tools/styles/styles.css';
```

## Registry setup

Packages publish to GitHub Packages, not the public npm registry. Each
consuming project needs a project-local `.npmrc` (committed — it contains
no secret, just an env-var reference):

```
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
@unctad-infovis:registry=https://npm.pkg.github.com
```

`GITHUB_PACKAGES_TOKEN` (a classic PAT with `read:packages`, and
`write:packages` if you're publishing) must be set in your shell
environment — never commit the actual token.

## Publishing a package change

From this repo's root:

```
npm version patch|minor -w packages/<package-name>   # bump
GITHUB_PACKAGES_TOKEN=$GITHUB_PACKAGES_TOKEN npm publish -w packages/<package-name>
```

Then in each consuming project, bump the dependency version in
`package.json` and `npm install`.

## Reusing vs. forking a shared component

Before adding a new local component to a project, check whether
`general-tools`/`minisite-tools`/`map-tools` already has it. If a project
needs something close-but-not-quite what the package provides:

- **The difference is a bug fix, or the package version is objectively more correct** (e.g. it now supports `prefers-reduced-motion` and the local copy doesn't) — adopt the package, don't fork.
- **The difference is a genuine design/content choice** (e.g. one report's `Footer` has real content links, another's has different ones; one project wants a 3-tier responsive `h3` scale, the package only has one breakpoint) — keep the project-local override, but scope it tightly using the project's own root ID so it reliably wins over the package's `.app`-scoped styles:

  ```css
  #app-root-<project_name> .app {
    /* only the properties that genuinely differ from the package */
  }
  ```

  Don't fork the whole component/file for a one-property difference — diff against the package version first and only override what's actually different.
- **The difference is reusable by more than one project** — upstream it into the shared package instead of leaving it duplicated.
