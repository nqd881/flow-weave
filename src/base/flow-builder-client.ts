import { IFlowExecutionContext } from "../abstraction";
import { FlowDefBuilder } from "./flow-def-builder";

export interface IFlowBuilderClient {
  newFlow<
    TContext extends IFlowExecutionContext = IFlowExecutionContext,
  >(): FlowDefBuilder<any, TContext>;
}
