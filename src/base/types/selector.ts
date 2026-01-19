import { IFlowExecutionContext } from "../../abstraction";

export type Selector<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TValue = unknown
> = (context: TContext) => TValue | Promise<TValue>;
