import { IContextTyped } from "./context-typed";
import { IFlowExecutionContext } from "./flow-execution-context";
import { IStepDef } from "./step-def";

export type FlowDefId = string;
export type FlowType = string;

export interface IFlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends IContextTyped<TContext> {
  readonly type: FlowType;
  readonly id: FlowDefId;
  readonly steps: IStepDef<TContext>[];
}
