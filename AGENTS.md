# Repository Instructions

## Running gmib

gmib checks configuration files for its activation signature during startup. Be careful when launching it from a sandbox or isolated environment: the app may not see the expected configs and
will behave as not activated. Do not treat a sandboxed launch as a valid activation or licensing
check unless the required config paths are explicitly available.

## README Updates

Keep `README.md` up to date when code changes add features, change existing behavior, or introduce details that matter to users or contributors. Add meaningful notes or comments there when they help explain the impact of the change.

## Commit Messages

Use Conventional Commits for all commit messages.

Examples:

- `fix: handle Electron dev launch environment`
- `chore: migrate pnpm settings to workspace config`
- `test: add preload coverage`

After each substantial and final change that should be committed separately, immediately suggest a commit message.
