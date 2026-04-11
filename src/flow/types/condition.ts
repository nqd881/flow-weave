import { IFlowContext } from "../../contracts";

export type Condition<
  TContext extends IFlowContext = IFlowContext
> = (context: TContext) => boolean | Promise<boolean>;
