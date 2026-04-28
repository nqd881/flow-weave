import { IFlowContext } from "../../contracts";
import {
  StepDefMetadata,
  StepHook,
  StepRecover,
  StepRetryPolicy,
} from "../../flow/step-defs";
import {
  ensureStaticDecoratorTarget,
  getPendingForMember,
} from "./metadata";

export function StepId(id: string) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "StepId");

    const pending = getPendingForMember(context.metadata, context.name);
    pending.stepMetadata.id = id;
  };
}

/**
 * @Retry(policy) — attaches retry policy to the step above.
 * Must be stacked below a step decorator (@Task, @Parallel, etc.)
 */
export function Retry<TContext extends IFlowContext = IFlowContext>(
  policy: StepRetryPolicy<TContext>,
) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Retry");

    const pending = getPendingForMember(context.metadata, context.name);
    pending.stepMetadata.retry = policy as StepRetryPolicy;
  };
}

/**
 * @Recover(handler) — attaches a recover handler to the step above.
 */
export function Recover<TContext extends IFlowContext = IFlowContext>(
  handler: StepRecover<TContext>,
) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Recover");

    const pending = getPendingForMember(context.metadata, context.name);
    pending.stepMetadata.recover = handler as StepRecover;
  };
}

/**
 * @PreHook(...hooks) — attaches pre-execution hooks to the step above.
 */
export function PreHook<TContext extends IFlowContext = IFlowContext>(
  ...hooks: StepHook<TContext>[]
) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "PreHook");

    const pending = getPendingForMember(context.metadata, context.name);
    const existing = pending.stepMetadata.hooks?.pre ?? [];

    pending.stepMetadata.hooks = {
      ...pending.stepMetadata.hooks,
      pre: [...(hooks as StepHook[]), ...existing],
    };
  };
}

/**
 * @PostHook(...hooks) — attaches post-execution hooks to the step above.
 */
export function PostHook<TContext extends IFlowContext = IFlowContext>(
  ...hooks: StepHook<TContext>[]
) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "PostHook");

    const pending = getPendingForMember(context.metadata, context.name);
    const existing = pending.stepMetadata.hooks?.post ?? [];

    pending.stepMetadata.hooks = {
      ...pending.stepMetadata.hooks,
      post: [...(hooks as StepHook[]), ...existing],
    };
  };
}
