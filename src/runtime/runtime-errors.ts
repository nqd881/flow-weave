export abstract class RuntimeError extends Error {}

export class FlowRuntimeNotFoundError extends RuntimeError {
  constructor() {
    super("Flow runtime not found");
  }
}

export class NestedChildFlowBaseRuntimeRequiredError extends RuntimeError {
  constructor() {
    super("Flow runtime must extend BaseFlowRuntime for nested child flow creation.");
  }
}

export class FlowRuntimeBindingCapabilityError extends RuntimeError {
  constructor() {
    super("Flow runtime requires parent-aware flow creation support.");
  }
}

export class FlowRuntimeAlreadyBoundError extends RuntimeError {
  constructor() {
    super("Flow runtime is already bound.");
  }
}

export class MissingStepExecutorError extends RuntimeError {
  constructor(stepTypeName: string) {
    super(`No executor registered for step type '${stepTypeName}'.`);
  }
}

export class FlowRuntimeNotBoundError extends RuntimeError {
  constructor() {
    super("Flow runtime is not bound.");
  }
}
