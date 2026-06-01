import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolveAdapter, runAdapter } from "./adapters.js";
import { parseWorkflow } from "./parser.js";
import { createRunDir, writeArtifact, writeReport } from "./report.js";

const STARTER_WORKFLOW = `name: agent-preview
description: Starter Aegtion workflow.
steps:
  - id: context
    note: "Describe what this workflow should prove before an agent change is merged."
  - id: check
    shell: "node --version"
  - id: review
    ai: "Review the current change and list the top 3 risks to verify."
  - id: approval
    approval: "Approve running the code task?"
  - id: code
    code: "Make the smallest safe improvement and summarize validation."
`;

export async function initWorkflow(targetPath) {
  await writeFile(targetPath, STARTER_WORKFLOW, { encoding: "utf8", flag: "wx" });
}

export function checkWorkflow(source, workflowPath) {
  return parseWorkflow(source, workflowPath);
}

export async function showLatestRun(workflowPath) {
  const runsDir = join(dirname(workflowPath), ".aegtion", "runs");
  const entries = await readdir(runsDir, { withFileTypes: true });
  const runs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const runDir = join(runsDir, entry.name);
        const info = await stat(runDir);
        return { runDir, mtimeMs: info.mtimeMs };
      })
  );

  if (runs.length === 0) {
    throw new Error(`No runs found in ${runsDir}`);
  }

  runs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const runDir = runs[0].runDir;
  return {
    runDir,
    reportPath: join(runDir, "report.md"),
    previewCommentPath: join(runDir, "preview-comment.md")
  };
}

export async function runWorkflow(source, workflowPath, options = {}) {
  const workflow = parseWorkflow(source, workflowPath);
  const rootDir = dirname(workflowPath);
  const runDir = await createRunDir(rootDir, workflow.name);
  const events = [];

  await mkdir(join(runDir, "artifacts"), { recursive: true });

  for (const [index, step] of workflow.steps.entries()) {
    const type = getStepType(step);
    const started = Date.now();
    const event = {
      index: index + 1,
      id: step.id,
      name: step.name,
      type,
      status: "running",
      durationMs: 0
    };

    try {
      const unmet = getUnmetNeeds(step, events);
      if (unmet.length > 0) {
        event.status = "skipped";
        event.summary = `Skipped because dependencies did not pass: ${unmet.join(", ")}`;
        event.durationMs = Date.now() - started;
        events.push(event);
        continue;
      }

      const result = await runStep(type, step, runDir, options);
      event.status = result.status;
      event.summary = result.summary;
      event.artifact = result.artifact;
    } catch (error) {
      event.status = "failed";
      event.error = error.message;
    }

    event.durationMs = Date.now() - started;
    events.push(event);

    if (event.status === "failed") {
      break;
    }
  }

  const status = events.every((event) => event.status === "passed" || event.status === "skipped")
    ? "passed"
    : "failed";
  await writeReport(runDir, workflow, events, status);
  return { status, runDir, events };
}

function getStepType(step) {
  return ["shell", "ai", "browser", "code", "approval", "note"].find((key) => key in step);
}

function getUnmetNeeds(step, events) {
  if (!step.needs) return [];
  const passedIds = new Set(events.filter((event) => event.status === "passed").map((event) => event.id));
  return step.needs.split(",").map((need) => need.trim()).filter((need) => need && !passedIds.has(need));
}

async function runStep(type, step, runDir, options) {
  if (options.dryRun) {
    const artifact = await writeArtifact(runDir, `${step.id}-${type}.md`, `# ${step.name}\n\nDry run skipped.\n`);
    return { status: "skipped", summary: "Dry run.", artifact };
  }

  if (type === "shell") return runCommandStep(step, runDir);
  if (type === "ai") return runAdapterStep("AI", process.env.AEGTION_AI_COMMAND, step.ai, step, runDir);
  if (type === "browser") return runAdapterStep("Browser", process.env.AEGTION_BROWSER_COMMAND, step.browser, step, runDir);
  if (type === "code") return runAdapterStep("Code", process.env.AEGTION_CODE_COMMAND, step.code, step, runDir);
  if (type === "approval") return runApprovalStep(step, runDir, options);
  if (type === "note") {
    const artifact = await writeArtifact(runDir, `${step.id}-note.md`, `# ${step.name}\n\n${step.note}\n`);
    return { status: "passed", summary: "Note recorded.", artifact };
  }
  throw new Error(`Unsupported step type: ${type}`);
}

async function runCommandStep(step, runDir) {
  const result = await runCommand(step.shell, {
    cwd: process.cwd(),
    env: process.env
  });
  const artifact = await writeArtifact(
    runDir,
    `${step.id}-shell.txt`,
    [`$ ${step.shell}`, "", result.stdout, result.stderr].join("\n")
  );
  if (result.code !== 0) {
    throw new Error(`Shell command exited with ${result.code}. See ${artifact}`);
  }
  return { status: "passed", summary: "Shell command completed.", artifact };
}

async function runAdapterStep(label, adapterCommand, prompt, step, runDir) {
  const promptPath = join(runDir, "artifacts", `${step.id}-${label.toLowerCase()}-prompt.md`);
  await writeFile(promptPath, `# ${step.name}\n\n${prompt}\n`, "utf8");
  const adapter = await resolveAdapter(label, adapterCommand);

  if (adapter.kind === "artifact") {
    const artifact = await writeArtifact(
      runDir,
      `${step.id}-${label.toLowerCase()}.md`,
      [
        `# ${step.name}`,
        "",
        `${label} adapter was not configured, so Aegtion made this step reviewable instead of silently faking it.`,
        "",
        "Install the native adapter or set this environment variable to execute it:",
        "",
        `\`AEGTION_${label.toUpperCase()}_COMMAND\``,
        "",
        "Prompt:",
        "",
        prompt
      ].join("\n")
    );
    return { status: "passed", summary: `${label} prompt artifact created.`, artifact };
  }

  const adapterEnv = {
    ...process.env,
    AEGTION_STEP_NAME: step.name,
    AEGTION_PROMPT: prompt,
    AEGTION_PROMPT_FILE: promptPath,
    AEGTION_RUN_DIR: runDir
  };
  const result = await runAdapter(adapter, prompt, adapterEnv);

  const artifact = await writeArtifact(
    runDir,
    `${step.id}-${label.toLowerCase()}-output.txt`,
    [result.stdout, result.stderr].join("\n")
  );
  if (result.code !== 0) {
    throw new Error(`${label} adapter exited with ${result.code}. See ${artifact}`);
  }
  return { status: "passed", summary: `${label} adapter completed.`, artifact };
}

async function runApprovalStep(step, runDir, options) {
  const artifact = await writeArtifact(runDir, `${step.id}-approval.md`, `# Approval\n\n${step.approval}\n`);

  if (options.yes) {
    return { status: "passed", summary: "Auto-approved with --yes.", artifact };
  }

  const rl = createInterface({ input, output });
  const answer = await rl.question(`${step.approval} [y/N] `);
  rl.close();

  if (!/^y(es)?$/i.test(answer.trim())) {
    throw new Error("Approval denied.");
  }
  return { status: "passed", summary: "Approved by user.", artifact };
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      ...options,
      shell: true,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
