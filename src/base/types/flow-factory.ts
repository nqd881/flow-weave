import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { IFlowBuilderClient } from "../flow-builder-client";

export type FlowFactory<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext,
> = (client: TClient) => IFlowDef<TContext>;
