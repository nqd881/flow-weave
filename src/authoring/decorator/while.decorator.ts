import { IFlowContext } from "../../contracts";
import { WhileStepDef, StepDefMetadata } from "../../flow/step-defs";
import { Condition, ContextAdapter } from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  resolveFlowRef,
} from "./metadata";

/**
 * @While(condition, flowRef) — static field or static method decorator.
 *
 * On a method: the method body IS the ContextAdapter.
 * On a field: no adapter (same context passthrough).
 *
 * @example
 * @While((ctx) => ctx.count < 10, iterationFlow)
 * static adaptIteration(ctx: ParentCtx) {
 *   return { items: ctx.items };
 * }
 */
export function While<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
>(
  condition: Condition<TContext>,
  flow: FlowRef<TBranchContext>,
) {
  return (
    target: Function | undefined,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "While");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    const adapt =
      context.kind === "method"
        ? (target as unknown as ContextAdapter<TContext, TBranchContext>)
        : undefined;

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) =>
        new WhileStepDef(
          condition as Condition,
          resolveFlowRef(flow),
          adapt as ContextAdapter | undefined,
          metadata,
        ),
      extensions,
    });
  };
}
