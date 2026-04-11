import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IStepDef } from "./step-def";
import { IStepExecutor } from "./step-executor";

export interface IFlowRuntime {
  resolveStepExecutor<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecutor<TStep> | undefined;

  createFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;
}
