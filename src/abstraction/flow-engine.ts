import { IClient } from "./client";
import { InferredContext } from "./context-typed";
import { FlowCtor, IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";

export interface IFlowEngine<TFlow extends IFlowDef = IFlowDef> {
  readonly flowKind: FlowCtor<TFlow>;

  createFlowExecution(
    client: IClient,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;
}
