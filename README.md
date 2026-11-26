# un-init-project

Six things live in this repo:

1. **`un-init-project`**, a CLI that scaffolds new UNCTAD data visualisation projects from a template. → [docs/scaffolding.md](docs/scaffolding.md)
2. **`packages/`**, an npm workspaces monorepo of shared code (`@unctad-infovis/*`) that scaffolded projects – and any project you build by hand – depend on instead of copy-pasting components. → [docs/packages.md](docs/packages.md)
3. **`un-audit-project`**, a CLI that recursively audits, updates, rebuilds and syncs already-scaffolded projects. → [docs/audit-project.md](docs/audit-project.md)
4. **`un-upload-documents`** + `/upload-documents`, a CLI and Claude Code skill that logs official documents (sessional documents, restricted documents, publications) from a gDoc2.0 email to Drupal – unrelated to the data-viz tooling above, but lives here as the CER Web Unit's third piece of shared automation. → [docs/upload-documents.md](docs/upload-documents.md)
5. **`un-create-datawrapper-chart`** + `/create-datawrapper-chart`, a CLI and Claude Code skill that builds UNCTAD-compliant Datawrapper charts – either from a CSV (`create`), or by copying an existing print/Publications chart to the web theme (`to-web`, source chart always left untouched) – with theme, locale, palette, country-group colours, and text-convention fixes applied automatically. The CLI/API path never publishes (the shared API token has no publish scope); the skill covers publishing via an authenticated browser session and logging the result as Drupal "Datawrapper" media, both only when explicitly asked. → [docs/datawrapper-chart.md](docs/datawrapper-chart.md)
6. **`un-compress-pdf`**, a CLI (and `compressPdf()` library function) that shrinks a PDF's embedded images via Ghostscript while leaving text/vectors untouched – ported from a standalone `compress-pdf.sh` tool. `un-upload-documents` calls this automatically on every PDF it stages, before editing its metadata (compression must come first – Ghostscript regenerates the PDF and always overwrites `/Producer`/`/Creator`, which would otherwise silently replace the original values `un-upload-documents` is careful to preserve). → [docs/compress-pdf.md](docs/compress-pdf.md)

If you're starting a new project, use the CLI (quick start below, full
details in [docs/scaffolding.md](docs/scaffolding.md)). Each of the six
things above has its own doc page under [`docs/`](docs/) — this README
stays an index and a quick start, not the full reference.

## Quick start: scaffolding a new project

`UN_PATH` needs to be set — this is the base path under which new project
folders are created (as `$UN_PATH/<current year>/<project_name>`, see
[docs/scaffolding.md](docs/scaffolding.md#where-projects-are-created)):

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

Default template is `react-vite`. Example: `un-init-project 2026-climate`.
See [docs/scaffolding.md](docs/scaffolding.md) for the full list of
templates and what happens on creation.

## Documentation

- [docs/scaffolding.md](docs/scaffolding.md) — `un-init-project`: setup, usage, templates, where projects are created.
- [docs/packages.md](docs/packages.md) — the `@unctad-infovis/*` packages: what each one is for, registry setup, publishing, reuse vs. forking.
- [docs/assets.md](docs/assets.md) — environment-aware asset resolution, hosted flags/icons.
- [docs/deploying.md](docs/deploying.md) — build/deploy scripts, the Drupal app manifest.
- [docs/audit-project.md](docs/audit-project.md) — `un-audit-project`: auditing and updating already-scaffolded projects.
- [docs/upload-documents.md](docs/upload-documents.md) — `un-upload-documents` / `/upload-documents`: logging official documents to Drupal.
- [docs/compress-pdf.md](docs/compress-pdf.md) — `un-compress-pdf`: shrinking a PDF's embedded images.
- [docs/datawrapper-chart.md](docs/datawrapper-chart.md) — `un-create-datawrapper-chart` / `/create-datawrapper-chart`: building UNCTAD-compliant Datawrapper charts.

`TODO.md` is this repo's running dev log/changelog (per-tool, dated,
append-only) — read it for *why* something works the way it does or
what's still unverified, not as a usage guide.
