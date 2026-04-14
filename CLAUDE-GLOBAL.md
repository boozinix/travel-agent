# Global Claude Rules

These are global Claude rules that apply across all projects, folders, and agents. Each project or folder may have further individual rules that must also be followed alongside these global rules.

## Git

- Only commit to git when explicitly instructed. Never commit automatically.
- Committing to git does NOT mean deploy to Vercel. These are separate actions.
- Only deploy to Vercel when explicitly instructed.
- Always keep `.gitignore` in mind before staging any files.

## API Keys & Secrets

- API keys and secrets are NEVER to be stored in the git repository (local or remote).
- API keys belong only in `.env.local` or equivalent local environment files.
- Always confirm `.env*` files (except `.env.example`) are in `.gitignore` before any commit.
- `.env.example` may be committed but must contain only placeholder values, never real keys.

## Project-Specific Overrides

- Individual projects may have their own rules about which files are kept in local git vs pushed to remote. Check the project-level `CLAUDE.md` for these rules before committing.

## Git Save Tracker

- Every project must have a `GIT_TRACKER.csv` at its root.
- Create it if it doesn't exist when the first commit is made.
- Update it on every commit, then include the updated tracker in that same commit.
- Columns: `save_number, datetime, branch, commit_hash, changes_summary`
- Example row: `1, 2026-04-12 14:30, main, a1b2c3d, Initial commit: added auth flow and login page`

## Large Task Execution

- For large or complex tasks, break the work into chunks and execute them sequentially without stopping.
- Complete each chunk fully before moving to the next — verify it works, then continue.
- Do not wait for the user to prompt each phase. Complete all chunks autonomously in one continuous run.
- This prevents token exhaustion from mid-task context buildup and ensures full task completion without progress loss.
- If a task is large enough to risk hitting token limits, announce the chunks upfront so the user knows the plan, then execute without interruption.

## Per-Project Setup (apply to every project)

- Each project manages its own `GIT_TRACKER.csv`.
- Each project manages its own `.env.local` (never committed) and `.env.example` (committed, placeholders only).
- Always verify `.env.local` is in `.gitignore` before the first commit on any project.
