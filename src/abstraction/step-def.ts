import { IContextTyped } from "./context-typed";
import { IFlowExecutionContext } from "./flow-execution-context";

export type StepDefId = string;

export interface IStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends IContextTyped<TContext> {
  readonly id: StepDefId;
}
