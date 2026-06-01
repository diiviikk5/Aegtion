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
node ./bin/aegtion.js init
node ./bin/aegtion.js doctor
node ./bin/aegtion.js adapters
node ./bin/aegtion.js run ./examples/landing-page-review.aegtion.yaml --yes
node ./bin/aegtion.js run ./examples/repo-sanity.aegtion.yaml --yes
node ./bin/aegtion.js latest ./examples/landing-page-review.aegtion.yaml
node ./bin/aegtion.js latest ./examples/landing-page-review.aegtion.yaml --format json
node ./bin/aegtion.js comment ./examples/landing-page-review.aegtion.yaml
node ./bin/aegtion.js graph ./examples/landing-page-review.aegtion.yaml
```

The run creates:

```txt
.aegtion/runs/<timestamp>-<workflow-name>/
  report.md
  preview-comment.md
  trace.json
  artifacts/
```

## Workflow syntax

```yaml
name: landing-page-review
requires: ai,browser
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

Step IDs are optional, but if provided they must be unique and use only letters, numbers, underscores, or hyphens.
Use `needs: step-id` or `needs: first,second` to skip a step unless its dependencies passed.
Use top-level `requires: ai,browser,code` when a workflow must fail instead of creating placeholder artifacts.

## Adapter commands

Aegtion is intentionally adapter-based. If a native command is installed, Aegtion uses it. If a command is not available, it still creates reviewable artifacts instead of pretending it ran an agent.

Native adapter detection:

- `ai` from [vercel-labs/ai-cli](https://github.com/vercel-labs/ai-cli): `ai text --format md "<prompt>"`
- `agent-browser` from [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser): `agent-browser chat "<task>"`
- `code` steps emit structured coding-agent task payloads compatible with hosted workers like [vercel-labs/coding-agent-template](https://github.com/vercel-labs/coding-agent-template)

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
- workflows can be viewed as node/edge graphs, inspired by [vercel-labs/zerolang](https://github.com/vercel-labs/zerolang)

## Next milestones

1. GitHub PR comment output.
2. Native `agent-browser` adapter.
3. Native `ai-cli` adapter.
4. Baseline comparison between `main` and current branch.
5. Hosted preview runs using an `open-agents` style worker.
6. Graph workflow view inspired by `zerolang`.
