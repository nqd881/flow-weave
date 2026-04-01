import {
  CONTEXT_TYPE,
  IFlowExecutionContext,
  IStepDef,
  StepExecutionStatus,
} from "../../abstraction";
import { v4 } from "uuid";

export type StepHookInfo = {
  stepId: string;
  stepType: string;
  status: StepExecutionStatus;
  error?: unknown;
};

export type StepHook<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = (context: TContext, info: StepHookInfo) => any;

export type StepHooks<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = {
  pre?: StepHook<TContext>[];
  post?: StepHook<TContext>[];
};

export type StepDefOptions<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = {
  id?: string;
  hooks?: StepHooks<TContext>;
};

export type StepOptions<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = {
  hooks?: StepHooks<TContext>;
};

export interface IHookedStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends IStepDef<TContext> {
  readonly hooks?: StepHooks<TContext>;
}

export class StepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> implements IHookedStepDef<TContext> {
  readonly [CONTEXT_TYPE]: TContext;

  public readonly id: string;

  public readonly hooks?: StepHooks<TContext>;

  constructor(options?: StepDefOptions<TContext>) {
    this.id = options?.id ?? v4();
    this.hooks = options?.hooks;
  }
}
