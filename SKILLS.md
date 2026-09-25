# SKILLS.md

Verification pass on the seven third-party skills/integrations proposed for
this project, checked against the real stack (React 19 + `react-scripts`
5.0.1, Laravel 12, Sanctum, MySQL/MariaDB, no CI/CD) rather than taken at
face value. This is a **findings document**, not yet applied — nothing here
has been installed or folded into `CLAUDE.md`. Once reviewed, the agreed
subset can be added to CLAUDE.md's existing "Skills: what's enabled and why"
table.

Sources checked via web search on 2026-09-25 (repo README/marketplace
listings, not the skill bodies themselves — this session has no ability to
install or execute third-party Claude Code plugins).

---

## Recommend: add

### 1. `laravel/agent-skills` — Simplifier Agent
[github.com/laravel/agent-skills](https://github.com/laravel/agent-skills)

Official Laravel-org plugin. The Simplifier Agent reviews recently-changed
PHP/Laravel code for clarity/convention without touching functionality —
install via `/plugin install laravel-simplifier@laravel`.

**Verified fit**: this project is plain Laravel 12 with no unusual
conventions to conflict with (`abort_unless` role checks, Eloquent
relationships, Sanctum — all standard). It's a narrower, official version of
what the already-enabled generic `code-review` skill does, specialized to
Laravel idioms specifically. Low risk: it's a review pass, not a codegen
tool, so it can't introduce the kind of unrequested scope the project's
"ask before assuming scope" rule guards against.

**Verdict: add.** Low risk, official source, directly matches the stack.

### 2. `jest-react-testing` (manutej/luxor-claude-marketplace)
[skills.sh/manutej/luxor-claude-marketplace/jest-react-testing](https://www.skills.sh/manutej/luxor-claude-marketplace/jest-react-testing)

**Verified fit**: checked `package.json` directly —
`@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`,
`@testing-library/user-event@13.5.0`, `react@19.2.8`, all run through
`react-scripts test`. The skill's stated compatibility (Jest 29+, RTL 13+,
React 16.8+) covers this exactly, and this is the actual frontend test
stack already in use (`Login.test.jsx`, `Home.test.jsx`,
`ManuelasMenu.test.jsx`, etc.) — not a stack swap.

**One caveat, not a blocker**: it's a third-party marketplace skill (not
Anthropic/Laravel-official), so it should be spot-checked once installed
against a real test file here before being trusted for anything beyond
"how do I test X" guidance — but the compatibility claim itself checks out
against this repo's real versions.

**Verdict: add**, with that one live spot-check before leaning on it hard.

---

## Recommend: skip

### 3. `JustSteveKing/laravel-api-skill`
[github.com/JustSteveKing/laravel-api-skill](https://github.com/JustSteveKing/laravel-api-skill)

Opinionated Laravel REST API architecture: boundary-first layering,
namespace-based API versioning with `Sunset` headers, resource-scoped
routes/controllers.

**Checked against the actual codebase**: `OrderController.php` and
`PaymentController.php` are already-working, ungraded-for-elegance
capstone controllers with no API versioning, no `Sunset` headers, and
validation/business logic living directly in the controller (not a
separate boundary layer) — deliberately, not by oversight; see this
project's existing "Trust boundaries" and "Roles & auth" sections in
`CLAUDE.md`, which document exactly how the auth/validation split works
today. This skill's opinions would push toward restructuring an already
turned-in, instructor-graded architecture late in the project for a
consistency benefit that has no real payoff here — there's no external API
consumer to version for, and no evidence this is graded on architecture
style vs. correctness.

**Verdict: skip.** Not because the skill is bad — because its opinions
target a problem (external API consumers, versioning discipline) this
project doesn't have, and adopting it now means restructuring working code
for a style, not a fix.

### 4. `taste-skill` (leonxlnx)
[github.com/leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)

Anti-generic-slop frontend design skill for landing pages/portfolios,
works from a pixel reference to extract structured design detail.

**Checked against actual current work**: relevant on its face — the
session's Home hero/Best-Sellers styling work already pulled live visual
references from two external sites by hand. But it's a 13-skill bundle
that actively *produces* design work from a brief, which runs directly
against this project's already-adopted `graphic-design-consultant`
approach (consult-then-confirm, never generate an artifact unless
explicitly asked) — installing it risks having two skills with opposite
defaults (one waits to be asked, one ships code) both eligible to fire on
the same "make the hero better" request, with no clear precedence rule
between them.

The install-count and star claims returned by search (85k+ stars, 3.9M
installs) also could not be verified from this sandbox and are unusually
high for a skill repo — treated as marketing copy, not evidence, per this
session's "don't fabricate verification" rule.

**Verdict: skip.** Real overlap risk with an already-working consult-first
skill, and its own numbers aren't independently checkable here.

### 5. `impeccable` (pbakaus)
[github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)

Design-token-driven frontend "craft/audit/polish/harden" lifecycle skill.

**Checked against actual current work**: timing looks good on the surface
— there's a live TODO.md item about consolidating ad hoc color hex values
into the three unused `:root` tokens, decided but explicitly **not yet
implemented pending go-ahead** (see "Color palette has no enforced system"
in TODO.md). But `impeccable` is built to actively *craft/polish* UI
end-to-end, which is the opposite of what was just asked for on that exact
item — the user said "hold off on doing it first, just add it in the to
do list." A skill whose whole design is to go ahead and build/polish
conflicts with this project's explicit "ask before assuming scope" and
per-task go-ahead pattern, on the very work it would be most tempted to
touch.

Same caveat as `taste-skill`: the reported install/star numbers (63k
stars) aren't independently verifiable from here.

**Verdict: skip**, for the same reason as `taste-skill` — not the
technology, the default behavior (act now vs. propose-and-wait) is wrong
for how this project is actually run.

### 6. Playwright MCP
[playwright.dev/mcp](https://playwright.dev/mcp/introduction)

Structured accessibility-tree-based browser automation via MCP, as an
alternative to screenshot/coordinate-driven automation.

**Checked against actual current tooling**: this session already has a
built-in browser pane (`mcp__Claude_Browser__*`) with `read_page`
(accessibility tree), `find`, `computer`, `get_page_text`,
`read_network_requests`, etc. — the exact same category of capability
Playwright MCP would add. It was used this session for the Best-Sellers
carousel work and the header/nav CSS fix, including the real, verified
gotcha that `requestAnimationFrame` is suspended while the pane is
backgrounded (worked around with `tabs_select`, not a Playwright-specific
fix). Adding a second, separate browser-automation MCP server would be
redundant with a tool already present and already working in this exact
environment.

**Verdict: skip** — not because Playwright MCP is bad, but because this
session's environment already has an equivalent tool; there's nothing
missing for it to fill.

### 7. Anthropic `frontend-design`
[github.com/anthropics/claude-code/tree/main/plugins/frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design)

Official Anthropic plugin: auto-activates on any "build a frontend"
request and pushes toward a bold, distinctive aesthetic direction
(brutalist, maximalist, retro-futuristic, luxury, playful, etc.) before
coding.

**Checked against actual current work**: this project already has a
settled, deliberate visual identity — pink/white brand palette, a
consult-first design skill (`graphic-design-consultant`) already reasoned
about and kept for exactly this kind of work, and CLAUDE.md's existing
"Deliberately not enabled" list already excludes `graphic-design-consultant`
itself from auto-triggering, on the reasoning that design decisions here
go through discussion first. `frontend-design` auto-activating on any
"build the frontend" ask would silently reintroduce that exact
auto-triggering behavior via a different plugin, and would actively push
this specific, already-branded capstone app toward "distinctive/bold"
aesthetic swings the instructor is grading against a UI that already
exists and works.

**Verdict: skip.** Directly conflicts with a design-workflow decision
already made and documented in `CLAUDE.md`.

---

## Summary

| Skill | Verdict | One-line reason |
|---|---|---|
| `laravel/agent-skills` (Simplifier) | **Add** | Official, matches stack exactly, review-only (no scope risk) |
| `jest-react-testing` | **Add** | Verified against real `package.json` versions; spot-check once live |
| `JustSteveKing/laravel-api-skill` | Skip | Opinions target a problem (API versioning) this project doesn't have |
| `taste-skill` | Skip | Overlaps/conflicts with already-adopted consult-first design skill |
| `impeccable` | Skip | Acts immediately; conflicts with the project's active "wait for go-ahead" pattern |
| Playwright MCP | Skip | Redundant with the browser pane tool already in this environment |
| Anthropic `frontend-design` | Skip | Conflicts with an already-documented design-workflow decision in CLAUDE.md |

**Update 9/25**: the two "add" items (`laravel/agent-skills` Simplifier
Agent, `jest-react-testing`) have been folded into CLAUDE.md's "Skills:
what's enabled and why" table. The five "skip" items above were not
installed.
