import { IFlowDef, IFlowContext } from "../../contracts";
import { ContextAdapter } from "./context-adapter";

export type Branch<
  TParentContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext
> = {
  flow: IFlowDef<TBranchContext>;
  adapt?: ContextAdapter<TParentContext, TBranchContext>;
};
