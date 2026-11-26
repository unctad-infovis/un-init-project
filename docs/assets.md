# Environment-aware asset resolution

See the [root README](../README.md) for the rest of this repo, and
[The `@unctad-infovis/*` packages](packages.md) for the packages referenced
below.

Every deployed project can run from three different origins: `localhost`
during development, `unctad-infovis.github.io/<project>` on gh-pages, or
`storage.unctad.org/<project>` in production. `general-tools/helpers/
BasePath.js` resolves the correct base URL:

```js
import basePath, { resolveAsset } from '@unctad-infovis/general-tools/helpers/BasePath.js';

resolveAsset('assets/img/hero.jpg'); // -> correct absolute/relative URL for wherever this is running
```

Use `resolveAsset()` (or `basePath() + 'relative/path'`) for any
project-local image referenced from JS. It cannot be used from CSS
`url()` — CSS is static, so per-project background images referenced in
CSS should be relative paths that Vite bundles normally.

## Hosted assets: `unctad-flags` and `unctad-icons`

Flags and UNCTAD-branded icons are used by many projects (`CircleFlag`,
`UNCTADSiteHeader`, `ButtonAnchor`, `Quote`), so bundling them per-project
means the same ~450 files get duplicated across every consumer's git
history and build output. Two things were tried and rejected before
landing on the current approach:

1. Duplicating the files into each project's `public/` folder — works,
   but is exactly the duplication problem this was meant to solve.
2. Bundling via Vite's `import.meta.glob()` — technically works, but Vite
   inlines small assets as base64 into the JS bundle regardless of how
   many are actually used on a given page, growing a typical bundle by
   3-4x for no benefit.

Instead, `unctad-flags` and `unctad-icons` export a URL resolver, not the
files themselves:

```js
import { getFlagUrl } from '@unctad-infovis/unctad-flags';
getFlagUrl('fr'); // -> hosted URL, resolved per-environment

import { getIconUrl } from '@unctad-infovis/unctad-icons';
getIconUrl('unctad_site_header_logo.png');
```

On `unctad.org` these resolve to
`storage.unctad.org/shared-resources/flags/round/` and
`storage.unctad.org/shared-resources/icons/`; everywhere else (dev,
gh-pages) they resolve to this repo's raw GitHub content (this repo is
public, so no auth is needed to fetch from it). The files stay as plain,
browser-cached `<img>` requests — nothing is bundled.

If you add or change a file in `packages/unctad-flags/src/round/` or
`packages/unctad-icons/src/`, sync it to production storage:

```
npm run sync-flags     # packages/unctad-flags/src/round -> storage.unctad.org/shared-resources/flags/round
npm run sync-icons     # packages/unctad-icons/src -> storage.unctad.org/shared-resources/icons
npm run sync-shared-resources   # both
```

(Needs `az`/`azcopy` authenticated against the storage account — run `npm
run login` first if it fails with an auth error.)

A few CSS-embedded icons (`ButtonAnchor.css`, `Quote.css`) reference the
`storage.unctad.org` URL directly rather than through the resolver, since
CSS `url()` can't call a JS function to branch per-environment. This means
those specific icons won't render on `localhost` until the initial sync
has happened at least once — acceptable since they rarely change.
