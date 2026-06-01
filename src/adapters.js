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

export async function listAdapters() {
  return [
    {
      stepType: "ai",
      repo: "vercel-labs/ai-cli",
      nativeCommand: "ai",
      detected: await commandExists("ai"),
      overrideEnv: "AEGTION_AI_COMMAND",
      defaultInvocation: "ai text --format md <prompt>"
    },
    {
      stepType: "browser",
      repo: "vercel-labs/agent-browser",
      nativeCommand: "agent-browser",
      detected: await commandExists("agent-browser"),
      overrideEnv: "AEGTION_BROWSER_COMMAND",
      defaultInvocation: "agent-browser chat <task>"
    },
    {
      stepType: "code",
      repo: "vercel-labs/coding-agent-template",
      nativeCommand: null,
      detected: Boolean(process.env.AEGTION_CODE_COMMAND),
      overrideEnv: "AEGTION_CODE_COMMAND",
      defaultInvocation: "custom coding-agent command"
    }
  ];
}

export function formatAdapters(adapters) {
  const lines = ["Aegtion adapters", ""];

  for (const adapter of adapters) {
    const status = adapter.detected ? "ready" : "missing";
    lines.push(`${status.padEnd(8)} ${adapter.stepType} -> ${adapter.repo}`);
    lines.push(`         command: ${adapter.defaultInvocation}`);
    lines.push(`         override: ${adapter.overrideEnv}`);
  }

  return lines.join("\n");
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
