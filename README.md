# Aegtion

Aegtion is a local-first workflow runner for AI-agent work. It is the small version of "GitHub Actions for AI agents": one file can combine shell checks, AI prompts, browser tasks, code tasks, approval gates, logs, and artifacts.

The goal is not to hide agent behavior. The goal is to make agent behavior reviewable.

## Why this exists

Normal CI knows how to run commands. Agent work also needs:

- model calls
- browser tasks
- code-editing tasks
- human approvals
- screenshots and reports
- trace artifacts that can be reviewed in a PR

Aegtion starts with the simplest useful version of that.

## Reference repos

Aegtion is designed around the genre of these projects:

- [vercel-labs/ai-cli](https://github.com/vercel-labs/ai-cli) for fast model-generation steps
- [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) for browser-agent tasks
- [vercel-labs/coding-agent-template](https://github.com/vercel-labs/coding-agent-template) for code-agent task execution patterns
- [vercel-labs/zerolang](https://github.com/vercel-labs/zerolang) as inspiration for structured agent workflows

## Run it

```bash
npm run demo
```

Or directly:

```bash
node ./bin/aegtion.js run ./examples/landing-page-review.aegtion.yaml --yes
```

The run creates:

```txt
.aegtion/runs/<timestamp>-<workflow-name>/
  report.md
  trace.json
  artifacts/
```

## Workflow syntax

```yaml
name: landing-page-review
steps:
  - shell: "node --version"
  - ai: "Review this landing page copy."
  - browser: "Open localhost:3000 and test signup."
  - approval: "Approve code changes?"
  - code: "Fix the top 3 issues."
```

Supported steps:

- `shell`: executes a shell command
- `ai`: writes a prompt artifact, or runs `AEGTION_AI_COMMAND`
- `browser`: writes a browser-task artifact, or runs `AEGTION_BROWSER_COMMAND`
- `code`: writes a code-task artifact, or runs `AEGTION_CODE_COMMAND`
- `approval`: pauses for human approval unless `--yes` is passed
- `note`: records context in the run

## Adapter commands

Aegtion is intentionally adapter-based. If a command is not configured, it still creates reviewable artifacts instead of pretending it ran an agent.

```bash
AEGTION_AI_COMMAND="ai" node ./bin/aegtion.js run ./workflow.yaml
AEGTION_BROWSER_COMMAND="agent-browser" node ./bin/aegtion.js run ./workflow.yaml
AEGTION_CODE_COMMAND="codex" node ./bin/aegtion.js run ./workflow.yaml
```

Each adapter receives:

- `AEGTION_STEP_NAME`
- `AEGTION_PROMPT`
- `AEGTION_PROMPT_FILE`
- `AEGTION_RUN_DIR`

## What makes it different

Most agent tools optimize for magic. Aegtion optimizes for review:

- every step leaves an artifact
- approval gates are first-class
- browser/code/model tasks share one trace
- failed runs can become PR comments later
- the workflow file is small enough to understand at a glance

## Next milestones

1. GitHub PR comment output.
2. Native `agent-browser` adapter.
3. Native `ai-cli` adapter.
4. Baseline comparison between `main` and current branch.
5. Hosted preview runs using an `open-agents` style worker.
6. Graph workflow view inspired by `zerolang`.
