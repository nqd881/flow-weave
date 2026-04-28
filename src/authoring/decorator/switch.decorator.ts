import { SwitchBranchRequiredError } from "../validation-errors";
import { IFlowContext } from "../../contracts";
import { SwitchStepDef, StepDefMetadata } from "../../flow/step-defs";
import { SwitchCase } from "../../flow/step-defs/switch-step-def";
import { Branch, ContextAdapter, Predicate, Selector } from "../../flow/types";
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

type CaseConfig = {
  predicate: Predicate<any, any>;
  flow: FlowRef;
  adapt?: ContextAdapter;
};

type DefaultConfig = {
  flow: FlowRef;
  adapt?: ContextAdapter;
};

// ── @Case ──

/**
 * @Case(predicateOrValue, flowRef, adapt?) — static field sub-decorator.
 * Pushes a switch case to be consumed by @Switch.
 *
 * If the first argument is not a function, it's treated as an equality check:
 *   @Case("card", cardFlow)  →  predicate: (v) => v === "card"
 */
export function Case<TValue = unknown>(
  predicateOrValue: Predicate<any, TValue> | TValue,
  flow: FlowRef,
  adapt?: ContextAdapter,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Case");

    const pending = getPendingForMember(context.metadata, context.name);
    const cases = (pending["cases"] ??= []) as CaseConfig[];

    const predicate: Predicate<any, TValue> =
      typeof predicateOrValue === "function"
        ? (predicateOrValue as Predicate<any, TValue>)
        : (value: TValue) => value === predicateOrValue;

    cases.push({ predicate, flow, adapt });
  };
}

// ── @Default ──

/**
 * @Default(flowRef, adapt?) — static field sub-decorator.
 * Sets the default branch for a @Switch step.
 */
export function Default(
  flow: FlowRef,
  adapt?: ContextAdapter,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Default");

    const pending = getPendingForMember(context.metadata, context.name);

    pending["defaultBranch"] = { flow, adapt } satisfies DefaultConfig;
  };
}

// ── @Switch ──

/**
 * @Switch(selector) — static field decorator.
 * Consumes @Case and @Default entries and creates a SwitchStepDef.
 *
 * @example
 * @Switch((ctx) => ctx.paymentMethod)
 * @Case("card", cardFlow)
 * @Case("crypto", cryptoFlow, (ctx) => ({ wallet: ctx.wallet }))
 * @Default(fallbackFlow)
 * static routePayment: void;
 */
export function Switch<
  TContext extends IFlowContext = IFlowContext,
  TValue = unknown,
>(selector: Selector<TContext, TValue>) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "Switch");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    // Reverse because TC39 decorators apply bottom-up on the same element
    const rawCases = ((pending["cases"] as CaseConfig[]) ?? []).reverse();
    const rawDefault = pending["defaultBranch"] as DefaultConfig | undefined;

    if (!rawCases.length && !rawDefault) {
      throw new SwitchBranchRequiredError();
    }

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) => {
        const cases: SwitchCase[] = rawCases.map((c) => ({
          predicate: c.predicate,
          flow: resolveFlowRef(c.flow),
          adapt: c.adapt,
        }));

        const defaultBranch: Branch | undefined = rawDefault
          ? { flow: resolveFlowRef(rawDefault.flow), adapt: rawDefault.adapt }
          : undefined;

        return new SwitchStepDef(
          selector as Selector,
          cases,
          defaultBranch,
          metadata,
        );
      },
      extensions,
    });
  };
}
