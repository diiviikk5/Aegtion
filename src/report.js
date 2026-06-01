import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function createRunDir(rootDir, workflowName) {
  const safeName = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = join(rootDir, ".aegtion", "runs", `${stamp}-${safeName}`);
  await mkdir(runDir, { recursive: true });
  await mkdir(join(runDir, "artifacts"), { recursive: true });
  return runDir;
}

export async function writeArtifact(runDir, name, content) {
  const path = join(runDir, "artifacts", name);
  await writeFile(path, content, "utf8");
  return path;
}

export async function writeReport(runDir, workflow, events, status) {
  const prComment = renderPrComment(workflow, events, status);
  const lines = [
    `# ${workflow.name}`,
    "",
    `Status: **${status}**`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Steps",
    ""
  ];

  for (const event of events) {
    lines.push(`### ${event.index}. ${event.name}`);
    lines.push("");
    lines.push(`Type: \`${event.type}\``);
    lines.push(`Status: **${event.status}**`);
    lines.push(`Duration: ${event.durationMs}ms`);
    if (event.summary) lines.push(`Summary: ${event.summary}`);
    if (event.artifact) lines.push(`Artifact: \`${event.artifact}\``);
    if (event.error) lines.push(`Error: \`${event.error}\``);
    lines.push("");
  }

  lines.push("## PR Comment");
  lines.push("");
  lines.push(prComment);

  const reportPath = join(runDir, "report.md");
  await writeFile(reportPath, lines.join("\n"), "utf8");
  await writeFile(join(runDir, "preview-comment.md"), prComment, "utf8");
  await writeFile(join(runDir, "trace.json"), JSON.stringify({ workflow, status, events }, null, 2), "utf8");
  return reportPath;
}

function renderPrComment(workflow, events, status) {
  const passed = events.filter((event) => event.status === "passed").length;
  return [
    `Aegtion preview for **${workflow.name}**: **${status}**`,
    "",
    `Passed ${passed}/${events.length} steps.`,
    "",
    "| Step | Type | Status |",
    "| --- | --- | --- |",
    ...events.map((event) => `| ${event.name} | ${event.type} | ${event.status} |`)
  ].join("\n");
}
