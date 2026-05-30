# Spec Kit Pilot — Phase 1

This directory is a **non-destructive pilot** on branch `speckit-pilot-phase-1`. It recreates
what [GitHub Spec Kit](https://github.com/github/spec-kit) produces, so you can compare the
Spec Kit flow against the existing `CLAUDE.md` + `phase-1.md` flow before committing to it.

> ⚠️ Scaffolded **by hand** because outbound network is restricted in this environment, so the
> official `specify` CLI (`uvx --from git+https://github.com/github/spec-kit.git specify init`)
> could not run. Structure and artifact shape mirror the real tool; it is not tool-generated.

## What's here
```
.speckit-pilot/
├── memory/constitution.md                     # ← projection of CLAUDE.md
└── specs/001-phase-1-data-layer/
    ├── spec.md      # WHAT/WHY  (from docs/budget-planner-spec.md + .feature)
    ├── plan.md      # HOW       (wrapper around /phase-1.md)
    └── tasks.md     # ordered, story-grouped task list
```
The real tool would also install `/speckit.*` slash commands into `.claude/commands/` and keep
its files under `.specify/` + top-level `specs/`. I used `.speckit-pilot/` so nothing collides
if you later run a real `specify init`.

## How the two flows map
| Spec Kit artifact | Your existing equivalent |
|---|---|
| `memory/constitution.md` | `CLAUDE.md` |
| `specs/NNN/spec.md` | `docs/budget-planner-spec.md` (whole-app) + `.feature` |
| `specs/NNN/plan.md` | `phase-1.md` |
| `specs/NNN/tasks.md` | the "Build sequence" inside `phase-1.md` |
| `/speckit.*` commands | the MUST-follow build order in `CLAUDE.md` (by discipline) |

## What the pilot shows
- **Spec Kit decomposes per-feature** (`specs/001-…`, `002-…`) rather than one app-wide spec —
  scales better as the app grows, but means decomposing your current monolithic spec.
- **Plan/tasks are forced artifacts** with a constitution check and explicit dependencies/
  parallel markers — more structure than your prose build sequence.
- **Heavy overlap** with what you already have. Adopting it for real means picking ONE source
  of truth (fold `CLAUDE.md` into the constitution; keep `.feature` as the acceptance layer)
  to avoid drift — don't run both.

## To adopt the real tool later (needs network)
1. `uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude`
2. Migrate `CLAUDE.md` → `memory/constitution.md` (or `/speckit.constitution`).
3. Re-run `/speckit.specify`, `/speckit.plan`, `/speckit.tasks` per phase; delete this pilot dir.

## Verdict prompt
Compare `specs/001-phase-1-data-layer/` here against `/phase-1.md`. If the extra structure earns
its keep, adopt Spec Kit starting with Phase 1; if `phase-1.md` already gives you everything you
need, your bespoke flow is sufficient and lighter.
