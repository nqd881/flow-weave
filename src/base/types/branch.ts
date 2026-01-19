import { IFlowDef, IFlowExecutionContext } from "../../abstraction";

export type BranchAdapter<
  TParentContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  TArgs extends any[] = unknown[]
> = (
  parentCtx: TParentContext,
  ...args: TArgs
) => TBranchContext | Promise<TBranchContext>;

export type Branch<
  TParentContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext
> = {
  flow: IFlowDef<TBranchContext>;
  adapt?: BranchAdapter<TParentContext, TBranchContext>;
};
