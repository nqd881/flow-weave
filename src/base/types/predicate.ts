import { IFlowExecutionContext } from "../../abstraction";

export type Predicate<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TValue = unknown
> = (value: TValue, context: TContext) => boolean | Promise<boolean>;
