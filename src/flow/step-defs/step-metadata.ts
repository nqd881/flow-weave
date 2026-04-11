import { IFlowContext, IStepDef, StepExecutionStatus } from "../../contracts";

export type StepHookInfo = {
  stepId: string;
  stepType: string;
  status: StepExecutionStatus;
  error?: unknown;
};

export type StepHook<
  TContext extends IFlowContext = IFlowContext,
> = (context: TContext, info: StepHookInfo) => any;

export type StepHooks<
  TContext extends IFlowContext = IFlowContext,
> = {
  pre?: StepHook<TContext>[];
  post?: StepHook<TContext>[];
};

export type StepDefMetadata<
  TContext extends IFlowContext = IFlowContext,
> = {
  id?: string;
  hooks?: StepHooks<TContext>;
};

export interface StepDefWithHooks<
  TContext extends IFlowContext = IFlowContext,
> extends IStepDef<TContext> {
  readonly hooks?: StepHooks<TContext>;
}
