import { IFlowContext } from "../../contracts";
import { ParallelForEachStepDef, StepDefMetadata } from "../../flow/step-defs";
import {
  ContextAdapter,
  ParallelStepStrategy,
  Selector,
} from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  resolveFlowRef,
} from "./metadata";

type ParallelForEachConfig<
  TContext extends IFlowContext = IFlowContext,
  TItem = unknown,
> = {
  items: Selector<TContext, TItem[]>;
  flow: FlowRef;
  strategy?: ParallelStepStrategy;
};

/**
 * @ParallelForEach(config) — static field or static method decorator.
 *
 * On a method: the method body IS the ContextAdapter<TContext, TBranchContext, [TItem]>.
 * On a field: no adapter (same context passthrough).
 *
 * @example
 * @ParallelForEach({
 *   items: (ctx) => ctx.orders,
 *   flow: processOrderFlow,
 *   strategy: "all-settled",
 * })
 * static adaptOrder(ctx: BatchCtx, order: Order) {
 *   return { orderId: order.id };
 * }
 */
export function ParallelForEach<
  TContext extends IFlowContext = IFlowContext,
  TItem = unknown,
>(config: ParallelForEachConfig<TContext, TItem>) {
  return (
    target: Function | undefined,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "ParallelForEach");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    const adapt =
      context.kind === "method"
        ? (target as unknown as ContextAdapter)
        : undefined;

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) =>
        new ParallelForEachStepDef<TContext, any, TItem>(
          config.items,
          resolveFlowRef(config.flow),
          adapt as ContextAdapter<TContext, any, [TItem]> | undefined,
          config.strategy ?? ParallelStepStrategy.AllSettled,
          metadata,
        ),
      extensions,
    });
  };
}
