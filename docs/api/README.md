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

`POST /api/screen` does not persist `addresses` or `brightness`, even if legacy callers send
them. Read the created record and then use `PUT /api/screen` with its id to set those fields.
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

Dynamic plugin handlers under `/api/plugins/{pluginId}` and local plugin routes under
`/plugins/{pluginId}/api` are deliberately excluded: the route set and DTOs are plugin-defined.
NovaStar is also excluded from this static document. It is mounted only after runtime startup when
the current license has the NovaStar capability, at the build-time `VITE_ANNOUNCE_PATH` prefix;
the source does not establish one universal path. WebSocket and static/public media surfaces are
outside this REST contract.
