import { IFlowDef, IFlowExecution } from "../contracts";
import { SagaDef, SagaExecution } from "../saga";
import { FlowDef } from "./flow-def";
import { FlowExecution } from "./flow-execution";

export type FlowExecutionOf<TFlow extends IFlowDef> = TFlow extends SagaDef
  ? SagaExecution<TFlow>
  : TFlow extends FlowDef
    ? FlowExecution<TFlow>
    : IFlowExecution<TFlow>;
