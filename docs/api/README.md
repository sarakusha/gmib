# GMIB management API contract

[`openapi.json`](openapi.json) is the machine-readable OpenAPI 3.1 description of the stable
router mounted at `/api`. It describes the contract implemented in
`packages/main/src/api.ts`, `apiAuth.ts`, and `srpAuthRouter.ts`; it does not start a Swagger UI
or add runtime validation.

## Authentication

Use either the local `Authorization: Bearer …` credential supplied to the local renderer, or all
three remote HMAC headers after SRP login. `GET /api/identifier`, SRP handshake/login, and no other
base routes marked with `security: []` are unauthenticated. In legacy `unsafeMode`, the router
does not mount the usual global authentication middleware, but password rotation remains strictly
authenticated.

For an executable implementation of SRP, server-proof (`M2`) verification, and HMAC signing, use
[`scripts/gmib-api-client.mjs`](../../scripts/gmib-api-client.mjs) or
[`scripts/gmib-api.mjs`](../../scripts/gmib-api.mjs). It signs the actual path plus query with
`HMAC-SHA256(METHOD + PATH_AND_QUERY + TIMESTAMP + BODY)`. `BODY` is omitted whenever the parsed
body is falsy (`undefined`, `null`, `false`, `0`, or an empty string), and also for an empty plain
object. For other JSON values it is `JSON.stringify(body)` (or the string itself), so callers must
serialize the same value they sign. Multipart `/api/media` reaches HMAC middleware before
formidable parses it, leaving `req.body` absent: do not include raw multipart bytes in `BODY`.

## Scope and limits

The JSON records response serialization and known request fields, but most legacy CRUD handlers
do not perform complete runtime JSON-schema validation. In particular, `PUT` operations replace
the stored fields represented by their input schema; send a complete object, rather than treating
them as partial updates. Database constraints and implementation errors can still produce the
generic error responses.

`POST /api/screen` does not persist `addresses`; `brightness` is unsupported on POST and passing a
defined value may fail at the current SQL binding boundary. Omit both fields, read the created
record, then use `PUT /api/screen` with its id to set them.
Player `width` and `height` are persisted on create and replacement update.

Scheduler input schemas describe the fields needed for a runnable job: `once` needs `runAt`,
`cron` needs a six-part schedule, and some actions require their target/value fields. The legacy
handlers can still store an incomplete body and report its missing action fields only when it runs.
Cron schedules have no timezone property and are evaluated in the GMIB host's local timezone;
send an ISO timestamp with an explicit offset for `once`. Persisted cron selections are sorted and
deduplicated, and priority is truncated to an integer.

Media upload is `multipart/form-data`, accepts image/video/MKV inputs selected by the runtime, and
has a six-hour HMAC timestamp window. Other remote HMAC requests have a five-minute window.
Mutations require an active license except the routes explicitly called out in the specification
(activation, license retry, updater checks/updates, and SRP/password administration); reads still
require authentication.

The noninteractive plugin lifecycle contract is under `/api/manage/v1/plugins`. It requires the
normal API authentication and the `plugins` license capability. Official installs are pinned by the
catalogue's exact version and SHA-256; archive inspection/install uses an
`application/octet-stream` body and an expected `sha256` query value. Installation additionally
requires exact permission and trusted-backend consent. Lifecycle responses separate desired and
running status and report `restartRequired`; repeated identical enable/install operations can return
`changed: false`. `PUT /{id}/enabled` returns `{changed, plugin}`. Archive uploads are limited to
50 MiB. The lifecycle router is mounted before the general license gate, so authenticated capability
failures return structured JSON 403 responses. Settings mutations are mounted through the general
API gate and may return its plain-text inactive-license 403.

The allowlisted runtime settings contract is under `/api/manage/v1/settings`. GET and PATCH remain
strictly authenticated even in `unsafeMode`; PATCH mutations also pass the active-license gate.
PATCH is partial, returns `{changed, dryRun, settings}`, and supports `dryRun=true` without
persistence or config broadcast. `spline:null` and `sunSpline:null` reset to the defaults in the
existing `configSchema`; `location:null` and `nightMode:null` clear those optional fields. The
endpoint changes desired configuration and broadcasts the config through the existing runtime path;
it does not move brightness algorithms, timers, sensor scheduling, or hardware commands into the
management router.

The saved-host synchronization contract is under `/api/manage/v1/hosts`. GET remains strictly
authenticated in `unsafeMode` and returns saved endpoints separately from the current passive mDNS
snapshot. Its revision covers only the normalized saved list. PUT carries that revision in the
signed JSON body, replaces the complete saved list, and returns 412 if the list changed in the
meantime; `dryRun=true` returns the predicted normalized list and revision without persistence.
Responses use `Cache-Control: no-store`. `nibusPort` is the stored NiBUS service port and `apiPort`
is its derived HTTP port (`nibusPort + 1`). The normalized endpoint `key` identifies an address/port
pair, not a physical machine, and the DTO contains no credentials, license material, or device
identifier.

Dynamic plugin handlers under `/api/plugins/{pluginId}` and local plugin routes under
`/plugins/{pluginId}/api` are deliberately excluded: the route set and DTOs are plugin-defined.
Plugins may optionally expose a plugin-owned authenticated `GET /openapi.json` through that generic
dispatch. The bounded [`shader-screensavers` example README](https://github.com/sarakusha/gmib-plugins/blob/main/plugins/shader-screensavers/README.md)
documents its own `/settings` DTOs and schema endpoint; this is an opt-in plugin convention, not a
universal settings format or a host requirement for every plugin. New plugin routes only need the existing Plugin API permissions
and generic HTTP dispatch; a plugin-specific schema can be absent and then returns the normal 404.
NovaStar is also excluded from this static document. It is mounted only after runtime startup when
the current license has the NovaStar capability, at the build-time `VITE_ANNOUNCE_PATH` prefix;
the source does not establish one universal path. WebSocket and static/public media surfaces are
outside this REST contract.
