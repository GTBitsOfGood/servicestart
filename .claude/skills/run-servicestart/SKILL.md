---
name: run-servicestart
description: Start, seed, run, screenshot and click through the ServiceStart web app locally (Next.js + Postgres) without Docker, and run its unit tests, lint and typecheck. Use when asked to run or start the app, check a change in the real app, log in as a seeded user, drive pages in a headless browser, call the API as a logged-in user, or run the test suite.
---

ServiceStart is a Next.js app backed by Postgres. In the Claude Code cloud container the Docker daemon is not running, so `setup.sh` runs Postgres natively, seeds it, stubs Juno (email/file infra) and starts `next dev`. You then drive the app by piping commands into `driver.mjs` (headless Chromium via Playwright). All paths are relative to the repo root.

## Prerequisites

Nothing to install in the cloud image: PostgreSQL 16 (`/usr/lib/postgresql/16`), Chromium (`/opt/pw-browsers/chromium`), Node 22 and pnpm 10.17.1 are already there. `setup.sh` runs as root (it uses `su postgres`).

## Start the app

```bash
.claude/skills/run-servicestart/setup.sh              # ~2 min cold, idempotent
RESET_DB=1 .claude/skills/run-servicestart/setup.sh   # also wipe + reseed the dev DB
```

It starts Postgres clusters `main` (:5432, user `dev`/`root`, dev DB) and `test` (:5433, user `test`/`root`, for unit tests), writes `.env` if missing, runs `pnpm install`, migrates, seeds an empty DB, starts the Juno stub on :8888 and `next dev` on :3000, and waits until `/login` answers. Logs go to `/tmp/servicestart/` (`dev.log`, `seed.log`, …). Every request the app sends to "Juno" (for example emails) is appended to `/tmp/servicestart/juno-requests.log`.

Seeded accounts (password `password123`) on http://localhost:3000, which is the `servicestart` org: `owner@example.com`, `admin@example.com` (admins), `member1@example.com`, `member2@example.com`, `joinrequest-pending@example.com`, `nonmember@example.com`.

## Drive it (agent path)

Pipe one command per line to the driver. It stops at the first failing command, saves `NN-error.png` and exits 1. Screenshots land in `/tmp/servicestart/shots/` (override with `SHOTS_DIR`); read them to check the page.

Use an unquoted heredoc so `$(date …)` expands. Driver variables use `{{name}}`.

```bash
node .claude/skills/run-servicestart/driver.mjs <<EOF
# Admin: create a draft event, publish it, add a shift through the API.
login admin@example.com
nav /events/create
fill 'input[name="title"]' Park cleanup
fill 'input[name="date"]' $(date -d '+30 days' +%F)
fill 'input[name="start"]' 10:00
fill 'input[name="end"]' 12:00
fill '[name="description"]' Bring gloves.
fill 'input[name="address"]' 123 Main St
fill 'input[name="city"]' Atlanta
fill 'input[name="state"]' GA
fill 'input[name="zip"]' 30332
fill 'input[name="capacity"]' 2
click 'role=button[name="Save draft"]'
wait-for 'role=link[name="Edit"]'
set eventId location.pathname.split("/").pop()
click 'role=button[name="Publish"]'
wait-for 'role=button[name="Unpublish"]'
shot published
api POST /api/shifts {"eventId":"{{eventId}}","startTimestamp":"$(date -d '+30 days' +%F)T15:00:00Z","duration":"1 hour","rsvpLimit":1}
# Member: register for the event, RSVP to the shift.
login member1@example.com
nav /events/{{eventId}}
click 'role=button[name="Register"]'
wait-for 'role=button[name="Unregister"]'
shot registered
set shiftId fetch("/api/events/{{eventId}}/shifts").then((r) => r.json()).then((j) => j.data[0].id)
api POST /api/shifts/{{shiftId}}/rsvps
login member2@example.com
api POST /api/shifts/{{shiftId}}/rsvps
errors
EOF
```

The last `api` call prints `409 {"error":"This shift has reached its capacity",…}`.

Admin email through the stub, plus the bell count (admin has 13 unread seeded notifications, member1 has 7):

```bash
node .claude/skills/run-servicestart/driver.mjs <<'EOF'
login admin@example.com
text 'button[aria-label="Notifications"]'
nav /members
click 'table tbody [role="checkbox"] >> nth=2'
click 'role=button[name="Email selected"]'
fill '[placeholder="Message Headline"]' Park cleanup
fill '[placeholder="Message Text"]' Meet at the main gate.
click 'role=button[name="Send Email"]'
wait-for 'text=Email sent.'
shot email-sent
EOF
tail -3 /tmp/servicestart/juno-requests.log
```

| command                         | what it does                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `login <email> [origin]`        | Fresh browser context, signs in with `password123`, waits out the post-login redirect. Origin defaults to localhost:3000. |
| `anon [origin]`                 | Fresh signed-out context.                                                                                                 |
| `nav <path or url>`             | Go to a page (paths are relative to the current origin) and wait for network idle.                                        |
| `click` / `hover` / `wait-for`  | Act on the first match of a Playwright selector. Quote selectors that contain spaces.                                     |
| `fill <selector> <text>`        | Fill an input; the rest of the line is the value.                                                                         |
| `press <key>` / `wait <ms>`     | Keyboard press / fixed pause.                                                                                             |
| `text <sel>` / `count <sel>`    | Print innerText / number of matches (`count` does not wait).                                                              |
| `shot <name> [full]`            | Screenshot (full page with `full`).                                                                                       |
| `api <METHOD> <path> [json]`    | `fetch` from the page with the user's cookies; prints status and body. Use this for the shift API, which has no UI yet.   |
| `eval <js>` / `set <name> <js>` | Evaluate an expression in the page (promises are awaited); `set` stores the result for `{{name}}` in later lines.         |
| `url` / `errors` / `quit`       | Current URL / console errors and 5xx responses since the last `errors` or `login` / stop.                                 |

## Test

```bash
pnpm run test:config && pnpm exec vitest run   # 51 files / 561 tests, ~2 min, uses the :5433 cluster
pnpm lint
pnpm format
pnpm exec tsc --noEmit --ignoreDeprecations 6.0
pnpm run db:check
```

`pnpm test` wraps the vitest run in `docker container start/stop servicestart-test-db`, which needs a Docker daemon, so call vitest directly. Plain `tsc --noEmit` stops on TS 6's `target: es5` deprecation before type-checking anything.

## Stop

```bash
lsof -ti:3000,8888 -sTCP:LISTEN | xargs -r kill
pg_ctlcluster 16 main stop; pg_ctlcluster 16 test stop
```

## Human path

With Docker Desktop, the README's `pnpm dev` (Juno + database containers + `next dev`) applies. It was not run here.

## Gotchas

- **Playwright's automation flag makes the app skip the active org.** `lib/hooks/useActiveOrganization.ts` skips `organization.setActive` when `navigator.webdriver` is true on localhost (an escape hatch for the e2e suite). Plain Playwright then gets `activeOrganizationId: null`, the bell shows nothing, and `/api/notifications/*` returns `400 No active organization`. The driver launches Chromium with `--disable-blink-features=AutomationControlled` so it behaves like a real browser.
- **The sandbox's HTTPS proxy intercepts `*.lvh.me`.** The dev server's hot-reload websocket then gets 403, the page keeps reloading and filled forms reset. The driver passes `--no-proxy-server` and maps `*.lvh.me` to 127.0.0.1. External images (placehold.co covers in the seed) fail to load; ignore them.
- **Other seeded orgs live on subdomains.** Use `login member1@example.com http://vertical-icon.lvh.me:3000` (also `horizontal-left`, `horizontal-center`). Each org has its own accounts under the same emails. `lib/auth.ts` trusts `*.<tenant domain>` and, outside production, `*.lvh.me`; without that, `set-active` fails with `403 INVALID_ORIGIN` and the session has no active org.
- **Unknown-tenant hosts don't hydrate under `next dev`.** For a host with no org (e.g. `nosuchorg.lvh.me`), the hot-reload websocket upgrade hangs and the page stays as server-rendered HTML, so the "Organization not found" screen never appears. The e2e spec `tests/e2e/auth-tenant-origin.spec.ts` covers it against `pnpm run build && pnpm run start` (see `playwright.config.ts`). My one `pnpm build` attempt here ended with the container restarting (exit 137).
- **Sign-in navigates twice.** After login the app calls `set-active` and then `router.push("/")`. A `goto` issued in that window fails with "interrupted by another navigation". The driver's `login` waits for it.
- **`button:text-is("X")` never matches BoG buttons.** The label is in an inner `<div>` and `:text-is` targets the innermost element. Use `role=button[name="X"]`, which matches exactly ("Publish" does not match "Unpublish").
- **The event create form has its own Publish button.** After "Save draft", wait for `role=link[name="Edit"]` (only on the event page) before reading the event id from the URL.
- **Seed data is dated.** Seeded events are all before September 2026, so the dashboard shows "No upcoming events". Create your own future event (the example uses `date -d '+30 days'`). Every seeded member also has a stray pending join request, so the Requests panel shows 9 pending. Each org has its own accounts under the same emails.
- **Changing `.env` needs a dev-server restart.** For example, `lib/junoClient.ts` reads `JUNO_API_KEY` at module load. Kill :3000 and re-run `setup.sh`.
- **Container restarts kill every background process.** The DB data under `/var/lib/postgresql` survives; re-run `setup.sh`.
- **Expected console noise:** a 401 from `get-full-organization` on the login page, and 4xx responses from your own `api` calls.

## Troubleshooting

- **`failed to connect to the docker API at unix:///var/run/docker.sock`**: no Docker daemon in the container. Use `setup.sh` (native Postgres) instead of `pnpm run db:create` / `pnpm dev`.
- **`400 No active organization` from `/api/notifications/unreadCount`**: the session has no active org, usually because the browser has `navigator.webdriver` set (see Gotchas). Use the driver.
- **`WebSocket connection to 'ws://<tenant>.lvh.me:3000/_next/webpack-hmr' failed … 403`** and forms emptying themselves: Chromium is going through the proxy. Launch with `--no-proxy-server`.
- **`500` on `POST /api/emails` with `JUNO_API_KEY is required` in `dev.log`**: `.env` has no Juno key. `setup.sh` writes `JUNO_API_KEY=local-stub-key` only when it creates `.env`, so add it by hand and restart the dev server.
- **`pg_lsclusters` shows `down`** (e.g. after a container restart): re-run `setup.sh`.
- **`count` prints 0 for an element you can see**: `count` doesn't wait. `wait-for` the element first.
