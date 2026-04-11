import type { IFlowContext } from "../../contracts";
import type { StepHook, StepHooks } from "../../flow/step-defs/step-metadata";

export interface IStepDefMetadataBuilder<
  TContext extends IFlowContext = IFlowContext,
> {
  hooks(hooks: StepHooks<TContext>): this;
  preHooks(...hooks: StepHook<TContext>[]): this;
  postHooks(...hooks: StepHook<TContext>[]): this;
}
