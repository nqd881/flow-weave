export abstract class AuthoringError extends Error {}

export class StepMetadataTargetMissingError extends AuthoringError {
  constructor() {
    super("Step metadata methods can only be used after declaring a step.");
  }
}

export class UnsupportedStepInvocationError extends AuthoringError {
  constructor() {
    super(
      "step(id, stepDef) is not supported. Add the step instance as-is or use step(id, StepClass, ...args).",
    );
  }
}

export class InvalidStepArgumentsError extends AuthoringError {
  constructor() {
    super("Invalid step() arguments.");
  }
}

export class NoStepToCompensateError extends AuthoringError {
  constructor() {
    super("No step to compensate.");
  }
}

export class ParallelStepBranchRequiredError extends AuthoringError {
  constructor() {
    super("Parallel step must have at least one branch.");
  }
}

export class ParallelForEachRunRequiredError extends AuthoringError {
  constructor() {
    super("ParallelForEach step requires run(...) before build.");
  }
}

export class ForEachRunRequiredError extends AuthoringError {
  constructor() {
    super("ForEach step requires run(...) before build.");
  }
}

export class TryCatchBranchRequiredError extends AuthoringError {
  constructor() {
    super("Try step must have a catch branch.");
  }
}

export class SwitchBranchRequiredError extends AuthoringError {
  constructor() {
    super("Switch step must have at least one branch.");
  }
}

export class WeaverMethodAlreadyDefinedError extends AuthoringError {
  constructor(name: string) {
    super(`Weaver method '${name}' is already defined.`);
  }
}
