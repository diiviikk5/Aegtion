import { spawn } from "node:child_process";

const CHECKS = [
  {
    name: "Node.js",
    command: "node --version",
    required: true,
    hint: "Install Node.js 18 or newer."
  },
  {
    name: "AI adapter",
    env: "AEGTION_AI_COMMAND",
    required: false,
    hint: "Set AEGTION_AI_COMMAND to an ai-cli compatible command."
  },
  {
    name: "Browser adapter",
    env: "AEGTION_BROWSER_COMMAND",
    required: false,
    hint: "Set AEGTION_BROWSER_COMMAND to an agent-browser compatible command."
  },
  {
    name: "Code adapter",
    env: "AEGTION_CODE_COMMAND",
    required: false,
    hint: "Set AEGTION_CODE_COMMAND to a coding-agent command."
  }
];

export async function runDoctor() {
  const results = [];

  for (const check of CHECKS) {
    if (check.command) {
      const result = await runCommand(check.command);
      results.push({
        ...check,
        ok: result.code === 0,
        value: result.stdout.trim() || result.stderr.trim()
      });
      continue;
    }

    const value = process.env[check.env] || "";
    results.push({
      ...check,
      ok: value.length > 0,
      value
    });
  }

  return results;
}

export function formatDoctor(results) {
  const lines = ["Aegtion doctor", ""];

  for (const result of results) {
    const status = result.ok ? "ok" : result.required ? "missing" : "optional";
    const detail = result.value ? ` - ${result.value}` : ` - ${result.hint}`;
    lines.push(`${status.padEnd(8)} ${result.name}${detail}`);
  }

  const requiredMissing = results.filter((result) => result.required && !result.ok);
  lines.push("");
  lines.push(requiredMissing.length === 0 ? "Ready to run local workflows." : "Required checks are missing.");
  return lines.join("\n");
}

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
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
