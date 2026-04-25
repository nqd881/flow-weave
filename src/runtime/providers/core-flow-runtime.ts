import { FlowDef } from "../../flow/flow-def";
import { registerBuiltInStepExecutors } from "../built-ins/register-built-in-step-executors";
import { StepExecutorRegistry } from "../step-executor-registry";
import { BaseFlowRuntime } from "./base-flow-runtime";

export class CoreFlowRuntime extends BaseFlowRuntime<FlowDef> {
  readonly flowKind = FlowDef;

  constructor(stepExecutorRegistry?: StepExecutorRegistry) {
    super(stepExecutorRegistry);

    if (stepExecutorRegistry) {
      return;
    }

    registerBuiltInStepExecutors(this.stepExecutorRegistry);
  }

  override clone() {
    return new CoreFlowRuntime(this.cloneStepExecutorRegistry());
  }
}
