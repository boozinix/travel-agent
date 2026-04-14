# Session Log — 2026-04-12 to 2026-04-14

## Topic: Global Claude Rules Setup

### What Was Discussed

**Q: How do I work across multiple projects, workspaces, agents, and folders in Claude Code?**
- Separate terminals per project, each running `claude`
- Git worktrees (`claude --worktree <name>`) for isolated branch work
- `@file` references to pull multiple files into one session
- Subagents for parallel tasks; experimental agent teams for coordination
- Session naming: `claude -n <name>`, resume with `claude --resume <name>`

**Q: How do I set global rules for Claude across all projects/agents?**
- Place rules in `~/.claude/CLAUDE.md` — loaded in every session automatically
- Hierarchy: `~/.claude/CLAUDE.md` (global) → repo `CLAUDE.md` (project) → subdir `CLAUDE.md` (local)
- All levels are merged; deeper files extend or override global ones

**Q: Why don't I see the `.claude` folder in Finder?**
- It's a dotfile (starts with `.`) — hidden by default in macOS
- Toggle visibility: `Cmd + Shift + .` in Finder
- Or open directly: `open ~/.claude`

---

### What Was Built

**File created:** `CLAUDE-GLOBAL.md`
- To be copied to `~/.claude/CLAUDE.md` for global effect
- Copy command: `cp CLAUDE-GLOBAL.md ~/.claude/CLAUDE.md`

**Rules written into CLAUDE-GLOBAL.md:**

1. **Git** — only commit when instructed; committing ≠ deploying to Vercel; always mind `.gitignore`
2. **API Keys & Secrets** — never in git (local or remote); only in `.env.local`; `.env.example` must use placeholders only
3. **Project-Specific Overrides** — check project-level `CLAUDE.md` for per-project git rules
4. **Git Save Tracker** — every project needs `GIT_TRACKER.csv`; create on first commit; update and include in every commit
5. **Large Task Execution** — chunk large tasks; complete each chunk before moving on; announce chunks upfront; no user babysitting required
6. **Per-Project Setup** — each project owns its own `GIT_TRACKER.csv` and `.env.local`

---

### Next Steps

- [ ] Copy `CLAUDE-GLOBAL.md` → `~/.claude/CLAUDE.md`
- [ ] Create `GIT_TRACKER.csv` in each new project on first commit
- [ ] Verify `.env.local` is in `.gitignore` for every project before committing
