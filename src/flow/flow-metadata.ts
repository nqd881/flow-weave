import { IFlowContext, IFlowDef } from "../contracts";
import { StepHooks } from "./step-defs";

export type FlowDefMetadata<
  TContext extends IFlowContext = IFlowContext,
> = {
  hooks?: StepHooks<TContext>;
};

export interface FlowDefWithHooks<
  TContext extends IFlowContext = IFlowContext,
> extends IFlowDef<TContext> {
  readonly hooks?: StepHooks<TContext>;
}
