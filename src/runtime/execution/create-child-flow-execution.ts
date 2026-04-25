import { InferredContext, IFlowDef, IFlowExecution } from "../../contracts";
import { BaseExecution } from "./base-execution";

export type CreateFlowExecution = <TFlow extends IFlowDef>(
  flowDef: TFlow,
  context: InferredContext<TFlow>,
  parentExecution?: BaseExecution,
) => IFlowExecution<TFlow>;
