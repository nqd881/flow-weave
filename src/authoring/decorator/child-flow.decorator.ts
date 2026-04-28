import { IFlowContext } from "../../contracts";
import { ChildFlowStepDef } from "../../flow/step-defs";
import { ContextAdapter } from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  resolveFlowRef,
} from "./metadata";
import { StepDefMetadata } from "../../flow/step-defs";

/**
 * @ChildFlow(flowRef, adapt?) — works on both static fields and static methods.
 *
 * On a field: uses the optional `adapt` argument (or no adapter).
 * On a method: the method body IS the ContextAdapter.
 *
 * @example
 * // Field — no adapter
 * @ChildFlow(subFlow)
 * static runSub: void;
 *
 * // Method — method body is the adapter
 * @ChildFlow(subFlow)
 * static adaptSub(ctx: ParentCtx) {
 *   return { value: ctx.amount };
 * }
 */
export function ChildFlow<
  TContext extends IFlowContext = IFlowContext,
  TChildContext extends IFlowContext = IFlowContext,
>(
  flow: FlowRef<TChildContext>,
  adapt?: ContextAdapter<TContext, TChildContext>,
) {
  return (
    target: Function | undefined,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "ChildFlow");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    // If applied to a method, the method body is the adapter
    const resolvedAdapt =
      context.kind === "method"
        ? (target as unknown as ContextAdapter<TContext, TChildContext>)
        : adapt;

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) =>
        new ChildFlowStepDef<TContext, TChildContext>(
          resolveFlowRef(flow),
          resolvedAdapt,
          metadata,
        ),
      extensions,
    });
  };
}
