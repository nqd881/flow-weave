import { TryCatchBranchRequiredError } from "../validation-errors";
import { IFlowContext } from "../../contracts";
import { TryCatchStepDef, StepDefMetadata } from "../../flow/step-defs";
import { ContextAdapter } from "../../flow/types";
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

type CatchConfig = {
  flow: FlowRef;
  adapt?: ContextAdapter;
};

// ── @Catch ──

/**
 * @Catch(flowRef, adapt?) — static field sub-decorator.
 * Sets the catch branch for a @Try step.
 * Must appear below @Try on the same field.
 */
export function Catch<
  TContext extends IFlowContext = IFlowContext,
  TCatchContext extends IFlowContext = IFlowContext,
>(
  flow: FlowRef<TCatchContext>,
  adapt?: ContextAdapter<TContext, TCatchContext, [unknown]>,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Catch");

    const pending = getPendingForMember(context.metadata, context.name);

    pending["catchBranch"] = {
      flow,
      adapt: adapt as ContextAdapter | undefined,
    } satisfies CatchConfig;
  };
}

// ── @Try ──

/**
 * @Try(flowRef, adapt?) — static field decorator.
 * Consumes @Catch entry and creates a TryCatchStepDef.
 *
 * @example
 * @Try(riskyFlow)
 * @Catch(recoveryFlow, (ctx, err) => ({ error: err }))
 * static safeOperation: void;
 */
export function Try<
  TContext extends IFlowContext = IFlowContext,
  TTryContext extends IFlowContext = IFlowContext,
>(
  flow: FlowRef<TTryContext>,
  adapt?: ContextAdapter<TContext, TTryContext>,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Try");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    const catchConfig = pending["catchBranch"] as CatchConfig | undefined;

    if (!catchConfig) {
      throw new TryCatchBranchRequiredError();
    }

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) => {
        const tryBranch = {
          flow: resolveFlowRef(flow),
          adapt: adapt as ContextAdapter | undefined,
        };

        const catchBranch = {
          flow: resolveFlowRef(catchConfig.flow),
          adapt: catchConfig.adapt,
        };

        return new TryCatchStepDef(tryBranch, catchBranch, metadata);
      },
      extensions,
    });
  };
}
