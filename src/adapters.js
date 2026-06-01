import { spawn } from "node:child_process";

export async function resolveAdapter(label, configuredCommand) {
  if (configuredCommand) {
    return { kind: "command", command: configuredCommand };
  }

  if (label === "AI" && await commandExists("ai")) {
    return { kind: "argv", command: "ai", args: ["text", "--format", "md"] };
  }

  if (label === "Browser" && await commandExists("agent-browser")) {
    return { kind: "argv", command: "agent-browser", args: ["chat"] };
  }

  return { kind: "artifact" };
}

export function runAdapter(adapter, prompt, env) {
  if (adapter.kind === "command") {
    return runCommand(adapter.command, { env });
  }

  if (adapter.kind === "argv") {
    return runArgv(adapter.command, [...adapter.args, prompt], { env });
  }

  throw new Error("Cannot execute artifact-only adapter.");
}

function commandExists(command) {
  const detector = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
  return runCommand(detector, { env: process.env }).then((result) => result.code === 0);
}

function runArgv(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      shell: process.platform === "win32",
      windowsHide: true
    });
    collect(child, resolve);
  });
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      ...options,
      shell: true,
      windowsHide: true
    });
    collect(child, resolve);
  });
}

function collect(child, resolve) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("close", (code) => resolve({ code, stdout, stderr }));
}
