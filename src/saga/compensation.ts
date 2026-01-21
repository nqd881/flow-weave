import { IFlowExecutionContext } from "../abstraction";

export type Compensation<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = (context: TContext) => any;
