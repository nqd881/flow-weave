import type { IFlowContext, IStepDef } from "../../contracts";
import type {
  StepDefMetadata,
  StepRecover,
  StepHook,
  StepHooks,
  StepRetryPolicy,
} from "../../flow/step-defs/step-metadata";
import type { IStepDefBuilder } from "./step-def-builder";
import type { IStepDefMetadataBuilder } from "./step-def-metadata-builder";

export abstract class BaseStepDefBuilder<
  TContext extends IFlowContext = IFlowContext,
  TStep extends IStepDef<TContext> = IStepDef<TContext>,
> implements IStepDefBuilder<TStep>, IStepDefMetadataBuilder<TContext> {
  protected stepHooks?: StepHooks<TContext>;
  protected stepRetryPolicy?: StepRetryPolicy<TContext>;
  protected stepRecoverHandler?: StepRecover<TContext>;

  abstract build(id?: string): TStep;

  protected createStepMetadata(id?: string): StepDefMetadata<TContext> {
    return {
      id,
      hooks: this.stepHooks,
      retry: this.stepRetryPolicy,
      recover: this.stepRecoverHandler,
    };
  }

  hooks(hooks: StepHooks<TContext>) {
    this.stepHooks = hooks;
    return this;
  }

  preHooks(...hooks: StepHook<TContext>[]) {
    this.stepHooks = {
      ...this.stepHooks,
      pre: [...(this.stepHooks?.pre ?? []), ...hooks],
    };

    return this;
  }

  postHooks(...hooks: StepHook<TContext>[]) {
    this.stepHooks = {
      ...this.stepHooks,
      post: [...(this.stepHooks?.post ?? []), ...hooks],
    };

    return this;
  }

  retry(policy: StepRetryPolicy<TContext>) {
    this.stepRetryPolicy = policy;
    return this;
  }

  recover(handler: StepRecover<TContext>) {
    this.stepRecoverHandler = handler;
    return this;
  }
}
