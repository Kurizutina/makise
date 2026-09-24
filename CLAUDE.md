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

## Investigation scope: stay narrow unless there's a named reason to widen

When fixing a specific bug or adding a new file/feature, only read the
file(s) directly involved. Don't explore the wider codebase unless a
specific reason requires it — name that reason before reading further (e.g.
"checking X because Y calls it and Y's behavior depends on it").

## Working style established this session

- **Verify live before claiming done.** Seed real test data (via `php artisan
  tinker` or a real API call), reproduce the bug first if one's being fixed,
  confirm the fix in the actual running app (not just code review or unit
  tests), then delete the test data. Both `php artisan test` and `npx
  react-scripts test` before calling anything finished — compare against the
  known-stale baseline (currently ~3 pre-existing backend failures,
  Login.test.jsx + ManuelasMenu.test.jsx on the frontend) so a regression
  doesn't hide inside "well, some tests always fail."
- **One TODO at a time, then stop and report** — don't chain into the next
  item without being asked. Match the report to the risk: a real bug fix gets
  the full reproduce → root-cause → fix → verify treatment; a small UI tweak
  doesn't need the same ceremony.
- **Commits: one per logical unit of work, not one per file or per micro-step.**
  Related changes (a fix plus the test that proves it) land together; don't
  flood history with saturated small commits.
- **TODO.md gets updated in its own commit**, batched per priority tier, moving
  finished items into "Completed Work" with what was actually verified, not
  just flipping the checkbox.
- **Ask before assuming scope** on an ambiguous request (e.g. "arrows" meant a
  simple trend indicator, not the full date-picker system a pasted brief
  implied) — confirm the small version rather than building the large one on
  spec.
