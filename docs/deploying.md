# Deploying a project

See the [root README](../README.md) for the rest of this repo, and
[Scaffolding a new project](scaffolding.md) for how a project is created
in the first place.

Every scaffolded project has the same deploy scripts:

```
npm run build           # vite build + scripts/postbuild.js (relative paths, bumps `version` in every public/assets/drupal-app*.json, generates a placeholder thumbnail if none exists)
git push && git push unctad main   # both GitHub and the Azure DevOps mirror
npm run sync-gh-pages   # git subtree push --prefix dist origin gh-pages
npm run sync-prod       # azcopy dist/ -> storage.unctad.org/<project>/
```

`dist/` is committed to git in most projects (needed for
`sync-gh-pages`'s subtree push to work) — check an individual project's
convention before assuming otherwise.

## Drupal app manifest

Every scaffolded project ships `public/assets/drupal-app.json`, the
machine-readable description Drupal needs to embed the app: `title`, the
`index`/`js`/`css` paths relative to the manifest itself, the `container`
markup to place in the page, `script_type`, a `thumbnail` and a `version`
counter.

A multi-page project (several Vite HTML entries, each embedded on its own
Drupal page — see `2026-beyond_gdp_data_hub` for the first example of
this) needs one manifest per embedded page instead of one for the whole
project: add another `.json` file per page directly under
`public/assets/` (e.g. `drupal-app.json` plus
`drupal-app.marimekko-focus.json`, `drupal-app.marimekko-chart.json`),
each with that page's own `title`/`index`/`js`/`css`. Drupal scans every
`.json` file in that folder for the manifest shape (a `schema` key)
rather than looking for a specific filename, so the name of the extra
files doesn't matter — keep the `drupal-app` prefix for discoverability,
not because anything requires it. `scripts/postbuild.js` does the same:
it detects a manifest by its `schema` key rather than by filename, so
every manifest present gets its `version` bumped and its thumbnail
checked — no further wiring needed.

```json
{
  "schema": 1,
  "title": "__PROJECT_NAME__",
  "index": "../index.html",
  "container": "<div id=\"app-root-__PROJECT_NAME__\" class=\"app-root-__PROJECT_NAME__\">Loading...</div>",
  "script_type": "module",
  "js": ["../js/__PROJECT_NAME__.min.js"],
  "css": ["font/fonts.css", "../css/__PROJECT_NAME__.min.css"],
  "thumbnail": "img/thumbnail.png",
  "version": "0"
}
```

`un-init-project` injects the real project name at scaffold time (it's
one of `INJECT_FILES` in `bin/init-project.js`), so
`title`/`container`/`js`/`css` are correct from the start. Two things
still need manual attention per project:

* **`title`** — defaults to the project's slug (e.g. `2026-rmt_report`); change
  it to the actual display title if Drupal should show something more readable.
* **`thumbnail`** — the template ships the placeholder path `img/thumbnail.png`,
  but no placeholder image. If no real image exists at that path by build time,
  `scripts/postbuild.js` generates a plain branded SVG placeholder (the
  manifest's `title` on a UNCTAD-blue background, no image library needed) and
  points `thumbnail` at it instead, so Drupal's app picker never shows a broken
  image. Drop a real image under `public/assets/img/` and update the path
  whenever one becomes available — the script only generates a placeholder
  when the declared file is missing, and never overwrites a real one.

`scripts/postbuild.js` bumps `version` by 1 on every `npm run build`,
writing the result to both the source copy in `public/assets/` and the
copy Vite already placed in `dist/assets/` — this is how Drupal (or a
cache-busting layer in front of it) can tell a new build apart from the
last one. Because the counter lives in the committed `public/` copy, it
persists correctly across builds; don't hand-edit `version` or reset it.

**Rollout status**: `2026-rmt_report` is the only existing project set up
as a Drupal "media type" this way so far. Every other already-scaffolded
project is still embedded in Drupal the old way, with hand-written
`<script>`/`<link>` tags pointing at `storage.unctad.org` (see an
individual project's README "Embedding" section). The plan is to migrate
those projects to the manifest method too, but that's a later, separate
effort — don't assume a project has `drupal-app.json` wired up on the
Drupal side just because the file exists in its repo (every project
scaffolded from now on has the file, but not necessarily a matching
Drupal media type yet).
