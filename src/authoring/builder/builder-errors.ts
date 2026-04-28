import { AuthoringError } from "../authoring-error";

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

export class WeaverMethodAlreadyDefinedError extends AuthoringError {
  constructor(name: string) {
    super(`Weaver method '${name}' is already defined.`);
  }
}
