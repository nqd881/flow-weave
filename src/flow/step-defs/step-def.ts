import {
  CONTEXT_TYPE,
  IFlowContext,
  IStepDef,
} from "../../contracts";
import { v4 } from "uuid";
import {
  StepDefMetadata,
  StepRecover,
  StepDefWithHooks,
  StepHooks,
  StepRetryPolicy,
} from "./step-metadata";

export class StepDef<
  TContext extends IFlowContext = IFlowContext,
> implements StepDefWithHooks<TContext> {
  readonly [CONTEXT_TYPE]: TContext;

  public readonly id: string;

  public readonly hooks?: StepHooks<TContext>;
  public readonly retry?: StepRetryPolicy<TContext>;
  public readonly recover?: StepRecover<TContext>;

  constructor(metadata?: StepDefMetadata<TContext>) {
    this.id = metadata?.id ?? v4();
    this.hooks = metadata?.hooks;
    this.retry = metadata?.retry;
    this.recover = metadata?.recover;
  }
}
