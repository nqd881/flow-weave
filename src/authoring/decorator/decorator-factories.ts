import { IStepDef, IFlowContext } from "../../contracts";
import { StepDefMetadata } from "../../flow/step-defs";
import { PendingMemberData, StepBuildFn } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  getPendingForMember,
} from "./metadata";

// ── createStepDecorator ──
// Creates a field decorator for a step. The factory receives pending data
// (from sub-decorators like @Retry, @Branch) and user-supplied args.

export function createStepDecorator<TArgs extends any[]>(
  factory: (
    pending: PendingMemberData,
    ...args: TArgs
  ) => StepBuildFn,
  decoratorName = "step decorator",
): (...args: TArgs) => (
  target: undefined,
  context: ClassFieldDecoratorContext,
) => void {
  return (...args: TArgs) => {
    return (_target: undefined, context: ClassFieldDecoratorContext) => {
      ensureStaticDecoratorTarget(context, decoratorName);

      const pending = consumePending(context.metadata, context.name);
      const { stepMetadata, ...extensions } = pending;

      addStepEntry(context.metadata, {
        order: getNextStepOrder(),
        propertyKey: context.name,
        stepMetadata: stepMetadata as StepDefMetadata | undefined,
        build: factory(pending, ...args),
        extensions,
      });
    };
  };
}

// ── createMethodStepDecorator ──
// Creates a method decorator for a step. The method is passed to the factory
// (e.g., for @Task where the method IS the handler).

export function createMethodStepDecorator<TArgs extends any[]>(
  factory: (
    pending: PendingMemberData,
    method: Function,
    ...args: TArgs
  ) => StepBuildFn,
  decoratorName = "step decorator",
): (...args: TArgs) => (
  target: Function,
  context: ClassMethodDecoratorContext,
) => void {
  return (...args: TArgs) => {
    return (target: Function, context: ClassMethodDecoratorContext) => {
      ensureStaticDecoratorTarget(context, decoratorName);

      const pending = consumePending(context.metadata, context.name);
      const { stepMetadata, ...extensions } = pending;

      addStepEntry(context.metadata, {
        order: getNextStepOrder(),
        propertyKey: context.name,
        stepMetadata: stepMetadata as StepDefMetadata | undefined,
        build: factory(pending, target, ...args),
        extensions,
      });
    };
  };
}

// ── createSubDecorator ──
// Creates a stacking decorator that pushes data to a pending key.
// Used by @Branch, @Case, etc. — decorators that accumulate data
// for a parent step decorator to consume.

export function createSubDecorator<TArgs extends any[], TData>(
  pendingKey: string,
  collect: (...args: TArgs) => TData,
  decoratorName = "step decorator",
): (...args: TArgs) => (
  target: undefined,
  context: ClassFieldDecoratorContext,
) => void {
  return (...args: TArgs) => {
    return (_target: undefined, context: ClassFieldDecoratorContext) => {
      ensureStaticDecoratorTarget(context, decoratorName);

      const pending = getPendingForMember(context.metadata, context.name);
      const items = (pending[pendingKey] ??= []) as TData[];

      items.push(collect(...args));
    };
  };
}
