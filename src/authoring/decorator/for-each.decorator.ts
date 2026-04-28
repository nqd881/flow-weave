import { IFlowContext } from "../../contracts";
import { ForEachStepDef, StepDefMetadata } from "../../flow/step-defs";
import { ContextAdapter, Selector } from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  resolveFlowRef,
} from "./metadata";

/**
 * @ForEach(itemsSelector, flowRef) — static field or static method decorator.
 *
 * On a method: the method body IS the ContextAdapter<TContext, TBranchContext, [TItem]>.
 * On a field: no adapter.
 *
 * @example
 * @ForEach((ctx) => ctx.items, itemFlow)
 * static adaptItem(ctx: Ctx, item: string) {
 *   return { currentItem: item };
 * }
 */
export function ForEach<
  TContext extends IFlowContext = IFlowContext,
  TItem = unknown,
>(
  items: Selector<TContext, TItem[]>,
  flow: FlowRef,
) {
  return (
    target: Function | undefined,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "ForEach");

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
        new ForEachStepDef<TContext, any, TItem>(
          items,
          resolveFlowRef(flow),
          adapt as ContextAdapter<TContext, any, [TItem]> | undefined,
          metadata,
        ),
      extensions,
    });
  };
}
