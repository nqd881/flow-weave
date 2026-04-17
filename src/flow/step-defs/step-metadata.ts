import {
  IFlowContext,
  IStepDef,
  StepExecutionFailureInfo,
  StepExecutionInfo,
} from "../../contracts";

export type StepHook<
  TContext extends IFlowContext = IFlowContext,
> = (context: TContext, info: StepExecutionInfo) => any;

export type StepHooks<
  TContext extends IFlowContext = IFlowContext,
> = {
  pre?: StepHook<TContext>[];
  post?: StepHook<TContext>[];
};

export type StepRetryBackoff = "constant" | "exponential";

export type StepRetryPolicy<
  TContext extends IFlowContext = IFlowContext,
> = {
  maxAttempts: number;
  initialDelayMs?: number;
  backoff?: StepRetryBackoff;
  maxDelayMs?: number;
  shouldRetry?: (
    error: unknown,
    attempt: number,
    context: TContext,
  ) => boolean | Promise<boolean>;
};

export type StepRecover<
  TContext extends IFlowContext = IFlowContext,
> = (
  error: unknown,
  context: TContext,
  info: StepExecutionFailureInfo,
) => any;

export type StepDefMetadata<
  TContext extends IFlowContext = IFlowContext,
> = {
  id?: string;
  hooks?: StepHooks<TContext>;
  retry?: StepRetryPolicy<TContext>;
  recover?: StepRecover<TContext>;
};

export interface StepDefWithHooks<
  TContext extends IFlowContext = IFlowContext,
> extends IStepDef<TContext> {
  readonly hooks?: StepHooks<TContext>;
}
