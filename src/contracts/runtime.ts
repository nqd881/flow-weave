import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";

export interface IRuntime {
  createFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;
}
