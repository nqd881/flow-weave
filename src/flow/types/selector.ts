import { IFlowContext } from "../../contracts";

export type Selector<
  TContext extends IFlowContext = IFlowContext,
  TValue = unknown
> = (context: TContext) => TValue | Promise<TValue>;
