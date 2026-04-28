import { ParallelStepBranchRequiredError } from "../validation-errors";
import { IFlowContext } from "../../contracts";
import { ParallelStepDef, StepDefMetadata } from "../../flow/step-defs";
import { ContextAdapter, ParallelStepStrategy } from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  getPendingForMember,
  resolveFlowRef,
} from "./metadata";

// ── Types ──

type BranchConfig = {
  flow: FlowRef;
  adapt?: ContextAdapter;
};

type ParallelConfig = {
  strategy?: ParallelStepStrategy;
};

// ── @Branch ──

/**
 * @Branch(flowRef, adapt?) — static field sub-decorator.
 * Pushes a branch to be consumed by @Parallel.
 * Stacked below @Parallel on the same field.
 * Bottom-up application means branches are reversed — @Parallel corrects this.
 */
export function Branch<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
>(
  flow: FlowRef<TBranchContext>,
  adapt?: ContextAdapter<TContext, TBranchContext>,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Branch");

    const pending = getPendingForMember(context.metadata, context.name);
    const branches = (pending["branches"] ??= []) as BranchConfig[];

    branches.push({ flow, adapt: adapt as ContextAdapter | undefined });
  };
}

// ── @Parallel ──

/**
 * @Parallel(config?) — static field decorator.
 * Consumes @Branch entries and creates a ParallelStepDef.
 *
 * @example
 * @Parallel({ strategy: "fail-fast" })
 * @Branch(emailFlow, (ctx) => ({ to: ctx.email }))
 * @Branch(inventoryFlow)
 * static fulfillOrder: void;
 */
export function Parallel(config?: ParallelConfig) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Parallel");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    // Reverse because TC39 decorators apply bottom-up on the same element
    const rawBranches = ((pending["branches"] as BranchConfig[]) ?? []).reverse();

    if (!rawBranches.length) {
      throw new ParallelStepBranchRequiredError();
    }

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) => {
        const branches = rawBranches.map((b) => ({
          flow: resolveFlowRef(b.flow),
          adapt: b.adapt,
        }));

        return new ParallelStepDef(
          branches,
          config?.strategy ?? ParallelStepStrategy.AllSettled,
          metadata,
        );
      },
      extensions,
    });
  };
}
