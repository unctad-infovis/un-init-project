# Scaffolding a new project

`un-init-project` creates a new UNCTAD data-visualisation project from one
of the templates in `templates/`. See the [root README](../README.md) for
what else lives in this repo.

## Setup

`UN_PATH` needs to be set — this is the base path under which new project
folders are created (see "Where projects are created" below):

```
export UN_PATH=''
```

Install once:

```
npm install && npm install -g
```

## Usage

```
un-init-project {project_name} [template_name]
```

Default template is `react-vite`. Example: `un-init-project 2026-climate`

### Where projects are created

A new project lands at `$UN_PATH/<current year>/<project_name>`, not
directly under `$UN_PATH` — `bin/init-project.js` always inserts the
current calendar year as a subfolder. `un-init-project 2026-climate` run
in 2026 creates `$UN_PATH/2026/2026-climate`.

### What happens on creation

- The chosen template's files are copied in, any symlinks inside the
  template (used internally for DRY template maintenance, see "Available
  templates" below) are resolved into real, independent copies, and
  `__PROJECT_NAME__` is injected into `index.html`, `package.json`,
  `README.md`, `public/assets/drupal-app.json`, and every `.css` file
  under `src/`.
- **The new project is opened automatically in Sublime Text** (`subl .`)
  once scaffolding finishes. This assumes the `subl` command-line tool is
  on your `PATH` (Sublime Text → *Install Command Line Tool...* on macOS);
  if it isn't, project creation itself still succeeds, but the final step
  will throw.

### Available templates

- **react-vite** — plain React + Vite, build everything from zero.
- **react-vite-highcharts-map** — React + Vite, pre-wired for a Highcharts map visualisation based on the UN country map.
- `react-webpack*` — deprecated, do not use.

`templates/shared/` is **not** a selectable template — it's the common
base that `react-vite`/`react-vite-highcharts-map` symlink into for
shared files (so e.g. `vite.config.js` or `biome.json` only need updating
in one place). It has no `package.json` of its own, so passing `shared` as
`template_name` would create a non-functional project; the CLI doesn't
currently block this explicitly, so just don't pass it.

See [Deploying a project](deploying.md) for what happens after scaffolding
(the Drupal app manifest, build/deploy scripts), and
[The `@unctad-infovis/*` packages](packages.md) for what a scaffolded
project depends on instead of copy-pasted components.
