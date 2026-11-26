# Auditing and updating existing projects

See the [root README](../README.md) for the rest of this repo.

`un-audit-project <path>` walks every scaffolded project under `<path>`
(or audits a single project directly) and, per project: skips it if the
git working tree isn't clean, runs `npm update` + `npm audit fix`,
rebuilds only if dependencies changed, diffs the build output against
`HEAD`, and commits + pushes (`--no-push` to skip) whatever actually
changed. If the production JS/CSS changed, it also runs `npm run
sync-prod`.

```
un-audit-project <path>                    # audit one project, or every project found recursively
un-audit-project <path> --dry-run          # report only, apply nothing
un-audit-project <path> --no-push          # commit locally, skip git push and sync-prod
un-audit-project <path> --skip-sync-prod   # do everything except the azcopy upload
```

Drop a `.un-audit-ignore` file (any content) in a project's root to
exclude it from discovery — useful for internal/demo projects. Run
history is kept in `~/.un-audit-project/state.json`, keyed by project
path.
