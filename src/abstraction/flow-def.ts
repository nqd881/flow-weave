import { IContextTyped } from "./context-typed";
import { IFlowExecutionContext } from "./flow-execution-context";
import { IStepDef } from "./step-def";

export type FlowDefId = string;

export interface IFlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends IContextTyped<TContext> {
  readonly id: FlowDefId;
  readonly steps: IStepDef<TContext>[];
}

export type FlowCtor<TFlow extends IFlowDef = IFlowDef> = {
  new (...args: any[]): TFlow;
  readonly kind: FlowCtor;
};
