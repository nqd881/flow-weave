import { IFlowDef, IFlowContext } from "../../contracts";

export type FlowDefFactory<TWeaver, TContext extends IFlowContext> = (
  weaver: TWeaver,
) => IFlowDef<TContext>;
