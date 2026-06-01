#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { showLatestRun, runWorkflow, checkWorkflow } from "../src/runner.js";

const args = process.argv.slice(2);
const command = args[0];
const workflowPath = args[1];

const flags = new Set(args.slice(2));

function printHelp() {
  console.log(`Aegtion

Usage:
  aegtion run <workflow.yaml|json> [--yes] [--dry-run]
  aegtion check <workflow.yaml|json>
  aegtion latest <workflow.yaml|json>

Environment adapters:
  AEGTION_AI_COMMAND       Command used for ai steps.
  AEGTION_BROWSER_COMMAND  Command used for browser steps.
  AEGTION_CODE_COMMAND     Command used for code steps.

Examples:
  npm run demo
  node ./bin/aegtion.js run ./examples/landing-page-review.aegtion.yaml --yes
`);
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (!workflowPath) {
  console.error("Missing workflow path.");
  printHelp();
  process.exit(1);
}

const absolutePath = resolve(process.cwd(), workflowPath);

try {
  if (command === "latest") {
    const latest = await showLatestRun(absolutePath);
    console.log(`Latest run: ${latest.runDir}`);
    console.log(`Report: ${latest.reportPath}`);
    console.log(`Preview comment: ${latest.previewCommentPath}`);
    process.exit(0);
  }

  const source = await readFile(absolutePath, "utf8");

  if (command === "run") {
    const result = await runWorkflow(source, absolutePath, {
      yes: flags.has("--yes"),
      dryRun: flags.has("--dry-run")
    });
    console.log(`\nAegtion run complete: ${result.status}`);
    console.log(`Run directory: ${result.runDir}`);
    process.exit(result.status === "passed" ? 0 : 1);
  }

  if (command === "check") {
    const workflow = checkWorkflow(source, absolutePath);
    console.log(`Workflow OK: ${workflow.name}`);
    console.log(`Steps: ${workflow.steps.length}`);
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
} catch (error) {
  console.error(`Aegtion failed: ${error.message}`);
  process.exit(1);
}
