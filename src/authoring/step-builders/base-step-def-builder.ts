import type { IFlowContext, IStepDef } from "../../contracts";
import type { StepHook, StepHooks } from "../../flow/step-defs/step-metadata";
import type { IStepDefBuilder } from "./step-def-builder";
import type { IStepDefMetadataBuilder } from "./step-def-metadata-builder";

export abstract class BaseStepDefBuilder<
  TContext extends IFlowContext = IFlowContext,
  TStep extends IStepDef<TContext> = IStepDef<TContext>,
> implements IStepDefBuilder<TStep>, IStepDefMetadataBuilder<TContext> {
  protected stepHooks?: StepHooks<TContext>;

  abstract build(id?: string): TStep;

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
}
