import { IFlowExecutionContext } from "../abstraction";

export type Compensation = <TContext extends IFlowExecutionContext>(
  context: TContext
) => Promise<any>;
