import { AuthoringError } from "../authoring-error";

export class StaticDecoratorTargetRequiredError extends AuthoringError {
  constructor(name: string) {
    super(`@${name} can only be used on static class members.`);
  }
}

export class InvalidFlowReferenceError extends AuthoringError {
  constructor() {
    super(
      "Flow reference must be an IFlowDef or a class decorated with @Flow or @Saga.",
    );
  }
}
