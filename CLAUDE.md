# CLAUDE.md

Working notes for Claude Code on this repo. Setup lives in [README.md](./README.md);
outstanding and completed work lives in [TODO.md](./TODO.md) — that file is the
source of truth for what's done and what's next, keep it current.

Otu-Zan: React frontend, Laravel 12 API, MySQL/MariaDB. Capstone project,
instructor-graded, shared with a teammate (Sean) via GitHub.

---

## Context window: hand off before quality drops, don't wait for auto-compact

Response quality is sharpest early in a session and measurably degrades as the
context window fills — not just a cost concern, an accuracy one. Auto-compact
reacts to that too late and guesses which details survive; it can drop something
load-bearing (a decision from this file, a live-verified fix) with no way to
tell it happened.

- **At ~50-60% context usage, proactively suggest a handoff** rather than
  grinding on in a degrading session: summarize the current task's state (what
  changed, what's verified, what's still open) into something the user can
  paste into a fresh session, then let them decide whether to continue there.
- **Don't wait for the "dumb zone" (~80%+) to say something.** By then the
  summary itself is being generated under the same degraded attention it's
  supposed to protect against.
- This file existing at all is part of the same practice — decisions and
  gotchas that would otherwise have to be re-derived from scratch (or
  re-discovered by re-triggering the same bug) every fresh session live here
  instead, so a handoff loses less.
- **Keep this file itself lean** — essential and current, not an
  ever-growing log. It documents real decisions and real gotchas, not a
  session-by-session diary; an entry that's no longer true or no longer
  load-bearing should be edited or removed, not left to accumulate next to
  the current ones.

## Accuracy over confidence

- **Say "I'm not sure" instead of guessing.** A wrong-but-confident answer
  about this codebase (a decision, a file's contents, whether something was
  actually fixed) is worse than admitting uncertainty and checking.
- **Re-read a file when precision matters, rather than trusting memory of
  what it contained earlier in a long conversation.** A file may have
  changed since it was last read, and recalling it from several messages
  back risks reconstructing it wrong instead of reading what's actually
  there now.
- **Don't keep one-off reference material attached to an ongoing working
  chat once its purpose is served** (e.g. a pasted training doc or an
  external example file used to draft something once) — it just adds
  tokens to every later exchange without adding value.

## Decisions that look arbitrary but aren't

- **"Revenue" means the delivery/service fee only (`Orders.ServiceFee`), never
  the item subtotal or a bill's pass-through amount.** Deliberate, 9/23 — it's
  what the business actually earns, not what changes hands. If a request talks
  about "sales" or "total revenue" meaning the full order value, that's a
  *different number* than what's live today — confirm which is meant before
  changing `OrderController::revenue`, don't assume.
- **Revenue currently counts every non-cancelled order, not just `delivered`
  ones.** So a `pending_rider` order's fee counts before it's actually
  completed. Not yet revisited — still open in TODO.md, not a bug to "fix"
  unilaterally.
- **Calendar-day bucketing is Asia/Manila, always** — `OrderDate` is stored
  UTC (`config('app.timezone')`), and a raw UTC-midnight boundary flips an
  order into "yesterday" mid-afternoon local time. `manilaDateString()` in
  `DeliveryAdminDashboard.jsx` and the equivalent `Carbon::parse(...)->setTimezone('Asia/Manila')`
  in `OrderController::revenue` are the two places this lives — keep both in
  sync if the business timezone ever needs to change.
- **`localStorage`'s `otuzanCustomerActivity` blob is shared per *browser*, not
  scoped per account.** `useCustomerActivity()` filters it by role at read
  time: `customer` and `driver` see only their own; `admin` sees everything
  (intentional — that's the whole point of the dashboard); no session returns
  **empty**, not the raw blob. That last branch is a real privacy fix (found
  live 9/23 — a guest could otherwise see the previous customer's order
  history on a shared device). Don't remove it to "simplify" the filter.
- **Live/actionable order lists (Live Orders, Payments) stay capped at
  `per_page=50` on purpose — History does not.** The cap is fine for a
  bounded, currently-active working set; it was a real bug for History, which
  only grows. History fetches its own page directly from `indexAll` with real
  pagination instead of reading the shared capped list.

## Gotchas already paid for

| Thing | Correct form |
|---|---|
| Laravel datetime → JS Date | Backend serializes naive `"2026-09-12 01:00:00"` (no `Z`). `toUtcIso()` in `src/utils/backendTime.js` appends it. Feeding it an already-`Z`-suffixed string (e.g. a test fixture built from `new Date().toISOString()`) produces an invalid double-`Z` date that crashes on `Intl.DateTimeFormat`/`new Date().format()`. Test fixtures must match the naive format, not ISO. |
| React 18 StrictMode + `setState` updater | Never mutate a ref (or anything else external) *inside* a functional `setState` updater — StrictMode double-invokes it in dev specifically to catch that, and the side effect only actually applies once, silently discarding the "first" result. Compute the side effect as a plain statement before calling `setState`, then pass a pure function. (Bit `Home.jsx`'s service-tab selection once already.) |
| Array/object props into effect deps | An inline `.map()`/`.filter()` in a render body (e.g. `CatalogBrandMenu`'s old `products = catalog.products.map(...)`) creates a new reference every render. Any child effect keyed on that prop tears down and rebuilds every time, even when the data is identical — which can leave a ref `null` mid-rebuild. `useMemo` it. |
| Hooks after an early `return` | React's Rules of Hooks apply per-render regardless of how obviously the early return depends on the same condition the hook needs. Move the hook above the return and make it null-safe internally instead. |
| `useCustomerActivity()` role branches | Explicit branches per role (`customer`, `driver`, `admin`); the fallthrough is for **no session**, not "whatever's left over." Don't collapse admin and guest into the same branch again. |
| Customer pages live in `src/Pages/costumer/` | Misspelled on purpose or not, it's the real folder — not `customer`. Searching for a "customer" folder can miss it or tempt creating a duplicate. |

## Roles & auth (backend is the real boundary, not the frontend)

Three roles: `customer`, `driver` (rider), `admin`. Two separate mechanisms
gate access, and they don't overlap the way you'd guess:

- **`permission:<name>` middleware** (`routes/api.php`, backed by
  `config/permissions.php` + `EnsurePermission` middleware) gates
  `catalog.manage`, `accounts.manage`, `riders.view`, `orders.manage` — all
  four are granted to `admin` only. `driver` and `customer` both have empty
  permission arrays in that config; they never go through this path.
- **`abort_unless($request->user()->Role === '...', 403)`** scattered
  per-controller is what actually gates `driver`/`customer` access (e.g.
  `OrderController`, `PaymentController`, `AccountManagementController`) —
  not a single central place, so a new customer/driver-only endpoint needs
  its own explicit check, not an assumption that the permission system
  covers it.
- **`src/routes/ProtectedRoute.jsx` is UX only, not a security boundary.**
  It redirects a stale/mismatched-role session to that role's own
  dashboard client-side — trivially bypassable, and not meant to be the
  real guard. The backend checks above are what actually enforce anything;
  don't reason about access control from the frontend route alone.

## Versions aren't pinned deliberately

`package.json` (`^19.2.8`) and `composer.json` (`^12.0`) both use ordinary
caret ranges — nobody pinned these on purpose, it's just what `npm
install`/`composer install` resolved to. Don't read a version number here
as a considered decision; bumping one isn't "helping" unless asked.

## Investigation scope: stay narrow unless there's a named reason to widen

When fixing a specific bug or adding a new file/feature, only read the
file(s) directly involved. Don't explore the wider codebase unless a
specific reason requires it — name that reason before reading further (e.g.
"checking X because Y calls it and Y's behavior depends on it").

## Skills: what's enabled and why

Checked against this repo's actual stack (React 19 + `react-scripts`, Laravel
12, MySQL/MariaDB, no CI/CD — no `.github/workflows` exists) and this
session's real recurring work, not speculatively. Also searched the broader
skill marketplace for anything React/Laravel/PHP-specific; nothing beyond
what's listed below came back relevant.

| Skill | Why it's enabled here |
|---|---|
| `run` | This session's actual verification loop, over and over: start `php artisan serve` + `npm start`, drive the browser, confirm the change. Formalizes what "Verify live before claiming done" below already requires by hand. |
| `code-review` | Catches correctness bugs in a diff (unused vars, logic slips) - complements, doesn't replace, live verification. Real fit: this repo's own Gotchas table below (StrictMode/setState, hooks-after-return) is exactly the bug class a diff review catches before it ever reaches a live test. |
| `security-review` | Real fit: Sanctum auth, RBAC (`abort_unless`), payment/bill flows, and an adversarial QA pass already on record (see TODO.md's Completed Work - rapid-click duplicate orders, RBAC probing, mass-assignment, SQLi checks). Formalizes that same pass for future auth/payment-touching changes. |
| `fewer-permission-prompts` | Quality-of-life only. This session repeated near-identical read-only calls (`php artisan tinker`, `git status`, `curl .../api/health`) many times, each prompting separately - allowlisting them cuts friction with no behavior change. |

**Deliberately not enabled:**

- `dataviz` - no charts exist yet. The admin revenue graph is a real but
  still-blocked TODO item (pending the revenue-definition decision) -
  revisit when that work actually starts, not before.
- `init` - would duplicate/conflict with this very file, which was hand-written
  and iterated on this session from real incidents, not generated. Manual
  wins; `init` risks overwriting deliberate content with generic boilerplate.
- `xlsx`/`docx`/`pptx`/`pdf`/`docs` (document-format skills) - nothing in this
  project's actual deliverable is a spreadsheet, Word doc, slide deck, or PDF.
- `claude-api` - no Anthropic/Claude API integration anywhere in this stack.
- `schedule`/`loop` - no recurring/cron automation need; this is a
  locally-run capstone app, not a service with scheduled jobs.
- Everything else in the general catalog (`artifact-*`, `morning`,
  `graphic-design-consultant`, `setup-claude`, `skill-creator`,
  `keybindings-help`, `update-config`, `consolidate-memory`,
  `import-memory`, `explain-usage`) - unrelated to this codebase's actual work.

## Working style established this session

- **Verify live before claiming done.** Seed real test data (via `php artisan
  tinker` or a real API call), reproduce the bug first if one's being fixed,
  confirm the fix in the actual running app (not just code review or unit
  tests), then delete the test data. Both `php artisan test` and `npx
  react-scripts test --watchAll=false` before calling anything finished —
  compare against the known-stale baseline so a regression doesn't hide
  inside "well, some tests always fail." Frontend baseline: 23/27 passing;
  the 4 failures are in `Login.test.jsx` and `ManuelasMenu.test.jsx`, both a
  JSDOM limitation (`scrollIntoView` isn't implemented there), not real bugs.
- **How to verify live as a specific role, without the login UI**: create a
  throwaway user via `php artisan tinker` (set `Role`/`UserType`, e.g.
  `'customer'`), mint a token with `$user->createToken('verify')->plainTextToken`,
  then in the browser set `sessionStorage.setItem('otuzanAuthenticated',
  '<token>')` and `sessionStorage.setItem('otuzanUser',
  JSON.stringify({id, role, UserName}))` (shape defined in
  `src/utils/session.js`) before navigating. Delete the test user/token
  (and any orders it created) once verification is done — don't leave test
  accounts in the database.
- **Two git remotes exist**: `origin` (`EdgarLouisA/Otu-Zan`, the shared team
  repo — Sean's) and `personal` (`Kurizutina/makise`, a personal fork). A
  bare `git push` is ambiguous and fails here. Push to the shared repo with
  `git push origin kurizu`.
- **One TODO at a time, then stop and report** — don't chain into the next
  item without being asked. Match the report to the risk: a real bug fix gets
  the full reproduce → root-cause → fix → verify treatment; a small UI tweak
  doesn't need the same ceremony.
- **Commits: one per logical unit of work, not one per file or per micro-step.**
  Related changes (a fix plus the test that proves it) land together; don't
  flood history with saturated small commits.
- **Don't push every edit to this file.** Draft/edit `CLAUDE.md` locally, but
  only commit and push a change here when it documents something genuinely
  necessary — a real decision, a real gotcha hit live, a real recurring
  friction point (the "Keep this file itself lean" rule above is the same
  principle applied to content; this is the same principle applied to when
  to push). If a change turns out to be minor, obvious, or not worth
  remembering next session, leave it unpushed or drop it rather than
  pushing it by default because an edit was made.
- **TODO.md gets updated in its own commit**, batched per priority tier, moving
  finished items into "Completed Work" with what was actually verified, not
  just flipping the checkbox.
- **Ask before assuming scope** on an ambiguous request (e.g. "arrows" meant a
  simple trend indicator, not the full date-picker system a pasted brief
  implied) — confirm the small version rather than building the large one on
  spec.
- **Commit code changes locally, but don't push until the user has tested it
  themselves and confirmed it's good.** Live verification in the browser
  pane confirms the change works from what the tool can drive and observe;
  it doesn't replace the user actually trying it in their own environment.
  Say the commit is ready and what to check, then wait for their go-ahead
  before `git push`.
