# Skills

Companion to [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md). Skills live
under `.agents/skills/` (tracked) with local symlinks under `.claude/skills/`
(gitignored), and are pinned in `skills-lock.json`. Invoke them explicitly when
the task matches — do not guess API details a skill already documents.

## Skills for this project

| Skill | Use it when |
|---|---|
| `laravel` | Any change under `laravel/` — Eloquent models, controllers, migrations, form requests, policies, Artisan |
| `php` | Plain PHP outside the framework, or language-level questions (types, attributes, composer scripts) |
| `react` | Component APIs, hooks, React 19 behavior, `react-router-dom` v7 routing in `src/` |
| `tailwindcss` | Styling work — this repo uses plain CSS files, so only reach for this if a Tailwind migration is actually underway |
| `mysql` / `database-design` | Schema questions against `backend/database/schema.sql` or the Laravel migrations; seven-table model, XAMPP MariaDB on 3306 |
| `testing` | Writing or fixing tests — `npm test` (React Testing Library) and `npm run backend:test` (Laravel Feature tests on in-memory SQLite) |
| `git-commit-workflow` | General conventional-commit guidance (third-party) |

**Where a third-party skill and this repo's docs disagree, AGENTS.md and
README.md win** — they know the XAMPP launcher, the port-5000 health check,
the dual frontend/backend `.env` split, and the pre-existing test failures
listed in TODO.md.

## Skills deliberately not installed

Because they contradict this stack:

- Expo / React Native / HeroUI skills — this is a web app (create-react-app
  style, `react-scripts`), not native.
- `callstack/react-navigation` — routing here is `react-router-dom` v7.
- shadcn/Radix skills — no component library is in use; UI is hand-rolled CSS.
- Firebase / Supabase skills — persistence is Laravel + MySQL/MariaDB only.
- Express backend skills — `backend/` is a dead migration reference; all live
  API work happens in `laravel/`.

If a skill install pulls in unrelated dependencies, check `skills-lock.json`
afterward and remove the noise with `npx skills remove <name> -y`.

## Editing notes

- `.claude/skills/` holds symlinks into `.agents/skills/` and is gitignored.
  The real content in `.agents/skills/` is what gets committed. Regenerate
  links locally with `npx skills add` if they are missing.
- Never commit `laravel/.env`, root `.env`, SMTP credentials, or database
  passwords — `.env.example` files are the only templates that belong in git.
- Shell heredocs are fragile for files containing `$` interpolation or regex
  (e.g. anything touching `.env` samples or validation rules) — prefer the
  Write/Edit tools over fighting PowerShell quoting.
- Verification block for "done": `npm run backend:db-check`,
  `npm run backend:test`, `npm test -- --watchAll=false`, `npm run build`.
  Treat the known pre-existing failures in TODO.md as baseline, not regressions.
