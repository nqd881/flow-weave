import type { IFlowContext } from "../../../contracts";
import type {
  StepRecover,
  StepHook,
  StepHooks,
  StepRetryPolicy,
} from "../../../flow/step-defs/step-metadata";

export interface IStepDefMetadataBuilder<
  TContext extends IFlowContext = IFlowContext,
> {
  hooks(hooks: StepHooks<TContext>): this;
  preHooks(...hooks: StepHook<TContext>[]): this;
  postHooks(...hooks: StepHook<TContext>[]): this;
  retry(policy: StepRetryPolicy<TContext>): this;
  recover(handler: StepRecover<TContext>): this;
}
