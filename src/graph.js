export function workflowToGraph(workflow) {
  const nodes = workflow.steps.map((step) => ({
    id: step.id,
    name: step.name,
    type: getStepType(step)
  }));

  const edges = workflow.steps.flatMap((step) => {
    if (!step.needs) return [];
    return step.needs
      .split(",")
      .map((need) => need.trim())
      .filter(Boolean)
      .map((need) => ({ from: need, to: step.id }));
  });

  return {
    name: workflow.name,
    description: workflow.description,
    nodes,
    edges
  };
}

export function formatGraph(graph) {
  const lines = [`graph ${graph.name}`, ""];

  lines.push("nodes:");
  for (const node of graph.nodes) {
    lines.push(`  ${node.id} [${node.type}] ${node.name}`);
  }

  lines.push("");
  lines.push("edges:");
  if (graph.edges.length === 0) {
    lines.push("  none");
  } else {
    for (const edge of graph.edges) {
      lines.push(`  ${edge.from} -> ${edge.to}`);
    }
  }

  return lines.join("\n");
}

function getStepType(step) {
  return ["shell", "ai", "browser", "code", "approval", "note"].find((key) => key in step);
}
