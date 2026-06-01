import { extname } from "node:path";

const STEP_TYPES = new Set(["shell", "ai", "browser", "code", "approval", "note"]);

export function parseWorkflow(source, filePath) {
  const ext = extname(filePath).toLowerCase();
  const workflow = ext === ".json" ? JSON.parse(source) : parseTinyYaml(source);
  validateWorkflow(workflow);
  return normalizeWorkflow(workflow);
}

function normalizeWorkflow(workflow) {
  return {
    name: workflow.name,
    description: workflow.description || "",
    steps: workflow.steps.map((step, index) => ({
      id: step.id || `step-${index + 1}`,
      name: step.name || inferStepName(step, index),
      ...step
    }))
  };
}

function inferStepName(step, index) {
  const type = Object.keys(step).find((key) => STEP_TYPES.has(key));
  return type ? `${type} ${index + 1}` : `step ${index + 1}`;
}

function validateWorkflow(workflow) {
  if (!workflow || typeof workflow !== "object") {
    throw new Error("Workflow must be an object.");
  }
  if (!workflow.name || typeof workflow.name !== "string") {
    throw new Error("Workflow must include a string name.");
  }
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error("Workflow must include at least one step.");
  }

  const ids = new Set();

  for (const [index, step] of workflow.steps.entries()) {
    const stepTypes = Object.keys(step).filter((key) => STEP_TYPES.has(key));
    if (stepTypes.length !== 1) {
      throw new Error(`Step ${index + 1} must include exactly one step type: ${[...STEP_TYPES].join(", ")}.`);
    }

    if (step.id) {
      if (!/^[A-Za-z0-9_-]+$/.test(step.id)) {
        throw new Error(`Step ${index + 1} has an invalid id. Use letters, numbers, underscores, or hyphens.`);
      }
      if (ids.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      ids.add(step.id);
    }

    if (step.needs && typeof step.needs !== "string") {
      throw new Error(`Step ${index + 1} needs must be a comma-separated string.`);
    }
  }

  for (const [index, step] of workflow.steps.entries()) {
    if (!step.needs) continue;
    const needs = step.needs.split(",").map((need) => need.trim()).filter(Boolean);
    for (const need of needs) {
      if (!ids.has(need)) {
        throw new Error(`Step ${index + 1} depends on unknown step id: ${need}`);
      }
      if (need === step.id) {
        throw new Error(`Step ${index + 1} cannot depend on itself.`);
      }
    }
  }
}

function parseTinyYaml(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, ""))
    .filter((line) => line.trim().length > 0);

  const workflow = { steps: [] };
  let inSteps = false;
  let currentStep = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "steps:") {
      inSteps = true;
      continue;
    }

    if (!inSteps) {
      const pair = parseKeyValue(trimmed);
      if (pair) workflow[pair.key] = pair.value;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      currentStep = {};
      workflow.steps.push(currentStep);
      const rest = trimmed.slice(2).trim();
      if (rest.length > 0) {
        const pair = parseKeyValue(rest);
        if (!pair) throw new Error(`Could not parse step line: ${line}`);
        currentStep[pair.key] = pair.value;
      }
      continue;
    }

    if (!currentStep) {
      throw new Error(`Step property appeared before a step: ${line}`);
    }

    const pair = parseKeyValue(trimmed);
    if (!pair) throw new Error(`Could not parse line: ${line}`);
    currentStep[pair.key] = pair.value;
  }

  return workflow;
}

function parseKeyValue(line) {
  const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (!match) return null;
  return {
    key: match[1],
    value: parseScalar(match[2])
  };
}

function parseScalar(value) {
  if (value === "") return "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}
