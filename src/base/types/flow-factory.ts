import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { IFlowBuilderClient } from "../flow-def-builder";

export type FlowFactory<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext
> = (client: TClient) => IFlowDef<TContext>;
