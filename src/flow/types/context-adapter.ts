import { IFlowContext } from "../../contracts";

export type ContextAdapter<
  TParentContext extends IFlowContext = IFlowContext,
  TChildContext extends IFlowContext = IFlowContext,
  TArgs extends any[] = unknown[],
> = (
  parentCtx: TParentContext,
  ...args: TArgs
) => TChildContext | Promise<TChildContext>;
