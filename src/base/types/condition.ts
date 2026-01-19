import { IFlowExecutionContext } from "../../abstraction";

export type Condition<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> = (context: TContext) => boolean | Promise<boolean>;
