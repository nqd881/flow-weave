import { IContextTyped } from "./context-typed";
import { IFlowContext } from "./flow-context";
import { IStepDef } from "./step-def";

export type FlowDefId = string;

export interface IFlowDef<
  TContext extends IFlowContext = IFlowContext,
> extends IContextTyped<TContext> {
  readonly id: FlowDefId;
  readonly steps: IStepDef<TContext>[];
}

export type FlowKind<TFlow extends IFlowDef = IFlowDef> = {
  new (...args: any[]): TFlow;
  readonly flowKind: FlowKind;
};
