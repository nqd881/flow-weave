import { IFlowContext } from "../../contracts";

export type Predicate<
  TContext extends IFlowContext = IFlowContext,
  TValue = unknown
> = (selectedValue: TValue, context: TContext) => boolean | Promise<boolean>;
