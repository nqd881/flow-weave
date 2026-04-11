import { InferredContext } from "./context-typed";
import { FlowKind, IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IFlowRuntime } from "./flow-runtime";

export interface IFlowExecutionFactory<
  TFlow extends IFlowDef = IFlowDef,
> {
  readonly flowKind: FlowKind<TFlow>;

  createFlowExecution(
    runtime: IFlowRuntime,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;
}
