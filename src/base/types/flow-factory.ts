import { IFlowDef, IFlowExecutionContext } from "../../abstraction";

export type FlowFactory<TClient, TContext extends IFlowExecutionContext> = (
  client: TClient,
) => IFlowDef<TContext>;
