import { IContextTyped } from "./context-typed";
import { IFlowContext } from "./flow-context";

export type StepDefId = string;

export interface IStepDef<
  TContext extends IFlowContext = IFlowContext,
> extends IContextTyped<TContext> {
  readonly id: StepDefId;
}
