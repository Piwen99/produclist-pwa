# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| implementation, commit splitting, chained PRs, or keeping tests and docs with code | work-unit-commits | /home/piwen/.config/opencode/skills/work-unit-commits/SKILL.md |
| creating, opening, or preparing PRs for review | branch-pr | /home/piwen/.config/opencode/skills/branch-pr/SKILL.md |
| creating GitHub issues, bug reports, or feature requests | issue-creation | /home/piwen/.config/opencode/skills/issue-creation/SKILL.md |
| Go tests, go test coverage, Bubbletea teatest, golden files | go-testing | /home/piwen/.config/opencode/skills/go-testing/SKILL.md |
| writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs | cognitive-doc-design | /home/piwen/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| PRs over 400 lines, stacked PRs, review slices | chained-pr | /home/piwen/.config/opencode/skills/chained-pr/SKILL.md |
| PR feedback, issue replies, reviews, Slack messages, or GitHub comments | comment-writer | /home/piwen/.config/opencode/skills/comment-writer/SKILL.md |
| judgment day, dual review, adversarial review, juzgar | judgment-day | /home/piwen/.config/opencode/skills/judgment-day/SKILL.md |
| new skills, agent instructions, documenting AI usage patterns | skill-creator | /home/piwen/.config/opencode/skills/skill-creator/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### work-unit-commits
- Commit by work unit — one clear purpose per commit
- Do not commit by file type (e.g., "add all models" then "add all tests")
- Keep tests with code — same commit as behavior they verify
- Keep docs with user-visible change they explain
- Each commit should be a candidate for chained PR if change grows
- Follow SDD workload guard — group into chained PR slices if >400 lines

### branch-pr
- Every PR MUST link an approved issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Branch naming: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- Conventional commits: `^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9\._-]+\))?!?: .+`
- PR body must contain: Linked Issue, PR Type, Summary, Changes Table, Test Plan

### issue-creation
- Blank issues are disabled — MUST use template (bug report or feature request)
- Every issue gets `status:needs-review` automatically
- Maintainer MUST add `status:approved` before any PR can be opened
- Questions go to Discussions, NOT issues

### go-testing
- Prefer table-driven tests for multiple cases; use `t.Run(tt.name, ...)`
- Test behavior and state transitions, not implementation trivia
- Use `t.TempDir()` for filesystem tests; never rely on a real home directory
- Keep integration tests skippable with `testing.Short()` when they run external commands
- Golden files must be deterministic; update only through `-update` path

### cognitive-doc-design
- Lead with the answer — decision/action/outcome first, context after
- Progressive disclosure — happy path first, then details and edge cases
- Chunking — group related info into small sections
- Signposting — use headings, labels, callouts so readers know where they are
- Recognition over recall — prefer tables, checklists, examples over prose

### chained-pr
- Split PRs over 400 changed lines unless maintainer accepts `size:exception`
- Keep each PR reviewable in ≤60 minutes
- One deliverable work unit per PR; keep tests/docs with unit they verify
- State start, end, prior dependencies, follow-up work, out-of-scope items
- Treat polluted diffs as base bugs: retarget or rebase until clean

### comment-writer
- Be useful fast — start with actionable point, no recap
- Be warm and direct — sound like a thoughtful teammate
- Keep it short — 1 to 3 short paragraphs or tight bullet list
- Explain why — give technical reason when asking for change
- Avoid pile-ons — comment on highest-value issue
- Match thread language (Spanish → Rioplatense voseo)

### judgment-day
- Resolve project skills before launching agents — inject same standards to both judges
- Launch two blind judges in parallel with identical target and criteria
- Wait for both judges before synthesis — never accept partial verdict
- Ask before fixing Round 1 confirmed issues
- Re-launch both judges in parallel after any fix
- Terminal states: `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`

### skill-creator
- Skill is runtime instruction contract for LLM, not human documentation
- Required frontmatter: `name`, `description`, `license`, `metadata.author`, `metadata.version`
- `description` MUST be one physical line, quoted, YAML-safe, ≤250 chars
- Target 180–450 tokens, max 1000, hard max 1000
- Put supporting material in `assets/` or `references/`, not main body
- Local references only — no external URLs

## Project Conventions

No project-level convention files found (AGENTS.md, .cursorrules, etc.).
Project is empty — conventions will be established during project setup.

## SDD Skills (Excluded from Delegation)

The following SDD workflow skills are installed but excluded from the delegation registry:
- sdd-init, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-archive, sdd-explore, sdd-onboard

These are orchestrator/executor skills, not coding skills for sub-agents.
