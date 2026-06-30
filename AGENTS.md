# Repository Instructions

## Running gmib

gmib checks configuration files for its activation signature during startup. Be careful when launching it from a sandbox or isolated environment: the app may not see the expected configs and
will behave as not activated. Do not treat a sandboxed launch as a valid activation or licensing
check unless the required config paths are explicitly available.

## User Documentation

Keep `README.md` and the built-in help at `packages/renderer/gmib/components/Help/Help.mdx` up to date and synchronized when code changes add features, change existing behavior, or introduce details that matter to users or contributors. Add meaningful notes or comments there when they help explain the impact of the change.

Do not add development artifacts such as build scripts, test commands, packaging details, or contributor-only workflow notes to `Help.mdx`; keep those in `README.md` or contributor documentation.

## Commit Messages

Use Conventional Commits for all commit messages.

Examples:

- `fix: handle Electron dev launch environment`
- `chore: migrate pnpm settings to workspace config`
- `test: add preload coverage`

After each substantial and final change that should be committed separately, immediately suggest a commit message.
