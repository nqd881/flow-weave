import {
  BaseFlowRuntime,
  RuntimeBuilder,
  StepExecutorRegistry,
} from "../../src";
import { FlowDef } from "../../src/flow";
import { CoreFlowRuntime } from "../../src/runtime";
import { registerBuiltInStepExecutors } from "../../src/runtime/built-ins/register-built-in-step-executors";

export abstract class TestCoreFlowRuntime<
  TFlow extends FlowDef<any> = FlowDef<any>,
> extends BaseFlowRuntime<TFlow> {
  constructor(stepExecutorRegistry?: StepExecutorRegistry) {
    super(stepExecutorRegistry);

    if (!stepExecutorRegistry) {
      registerBuiltInStepExecutors(this.stepExecutorRegistry);
    }
  }
}

export function createConfiguredCoreRuntime(
  configure?: (flowRuntime: CoreFlowRuntime) => void,
) {
  const flowRuntime = new CoreFlowRuntime();

  configure?.(flowRuntime);

  return new RuntimeBuilder().withFlowRuntime(flowRuntime).build();
}
