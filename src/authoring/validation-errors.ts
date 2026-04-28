import { AuthoringError } from "./authoring-error";

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
