import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { IFlowBuilderClient } from "../flow-client-builder";

export type FlowFactory<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext,
> = (client: TClient) => IFlowDef<TContext>;
