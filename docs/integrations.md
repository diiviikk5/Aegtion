# Integrations

Aegtion is a small runner, not a fork of the reference projects. It connects to them through native adapter detection, structured artifacts, and graph output.

## vercel-labs/ai-cli

Repo: https://github.com/vercel-labs/ai-cli

Used by `ai` steps. If the `ai` command is installed, Aegtion runs:

```bash
ai text --format md "<prompt>"
```

Override:

```bash
AEGTION_AI_COMMAND="ai text --format md" node ./bin/aegtion.js run ./workflow.yaml
```

## vercel-labs/agent-browser

Repo: https://github.com/vercel-labs/agent-browser

Used by `browser` steps. If the `agent-browser` command is installed, Aegtion runs:

```bash
agent-browser chat "<task>"
```

Override:

```bash
AEGTION_BROWSER_COMMAND="agent-browser chat" node ./bin/aegtion.js run ./workflow.yaml
```

## vercel-labs/coding-agent-template

Repo: https://github.com/vercel-labs/coding-agent-template

Used by `code` steps through structured task artifacts. If no code adapter command is configured, Aegtion writes a JSON payload like:

```json
{
  "type": "coding-agent-task",
  "source": "aegtion",
  "stepId": "code-fix",
  "task": "Apply the top safe fixes.",
  "expectedArtifacts": ["patch", "summary", "validation"]
}
```

Override:

```bash
AEGTION_CODE_COMMAND="your-coding-agent-worker" node ./bin/aegtion.js run ./workflow.yaml
```

## vercel-labs/zerolang

Repo: https://github.com/vercel-labs/zerolang

Used as design inspiration for graph-first agent workflows. Aegtion exposes workflow nodes and edges with:

```bash
node ./bin/aegtion.js graph ./examples/landing-page-review.aegtion.yaml
node ./bin/aegtion.js graph ./examples/landing-page-review.aegtion.yaml --format json
```

## vercel-labs/open-agents

Repo: https://github.com/vercel-labs/open-agents

Not directly embedded yet. Aegtion's run artifacts, preview comments, and structured coding tasks are designed so an `open-agents` style background worker can execute workflows and publish results later.
