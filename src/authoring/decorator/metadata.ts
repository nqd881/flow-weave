import {
  InvalidFlowReferenceError,
  StaticDecoratorTargetRequiredError,
} from "./decorator-errors";
import { IFlowContext, IFlowDef } from "../../contracts";
import { FlowClass, FlowRef, PendingMemberData, StepEntry } from "./types";

// ── Symbol.metadata polyfill ──
// Node 24 has native support, but this ensures compatibility
(Symbol as any).metadata ??= Symbol("Symbol.metadata");

// ── Step Order ──
// Global counter for preserving source-order of steps.
// TC39 guarantees member decorators within a class evaluate in source order,
// so a global counter correctly captures declaration order.
let stepOrderCounter = 0;

export function getNextStepOrder(): number {
  return stepOrderCounter++;
}

// ── Metadata Keys ──
const STEPS_KEY = "flow-weave:steps";
const PENDING_KEY = "flow-weave:pending";

type StaticMemberDecoratorContext =
  | ClassMethodDecoratorContext
  | ClassFieldDecoratorContext;

// ── Step Entries ──
// Each class gets its own steps array (not inherited from parent)
export function getOwnSteps(metadata: DecoratorMetadata): StepEntry[] {
  if (!Object.hasOwn(metadata, STEPS_KEY)) {
    (metadata as any)[STEPS_KEY] = [];
  }
  return (metadata as any)[STEPS_KEY] as StepEntry[];
}

export function addStepEntry(
  metadata: DecoratorMetadata,
  entry: StepEntry,
): void {
  getOwnSteps(metadata).push(entry);
}

// ── Pending Member Data ──
// Per-member pending data, used by sub-decorators (@Branch, @Retry, etc.)
// to accumulate data that the main step decorator will consume.

function getPendingMap(
  metadata: DecoratorMetadata,
): Record<string | symbol, PendingMemberData> {
  if (!Object.hasOwn(metadata, PENDING_KEY)) {
    (metadata as any)[PENDING_KEY] = {};
  }
  return (metadata as any)[PENDING_KEY] as Record<
    string | symbol,
    PendingMemberData
  >;
}

export function getPendingForMember(
  metadata: DecoratorMetadata,
  name: string | symbol,
): PendingMemberData {
  const map = getPendingMap(metadata);

  if (!map[name]) {
    map[name] = { stepMetadata: {} };
  }

  return map[name]!;
}

/**
 * Reads and removes the pending data for a member.
 * Called by the main step decorator to consume accumulated sub-decorator data.
 */
export function consumePending(
  metadata: DecoratorMetadata,
  name: string | symbol,
): PendingMemberData {
  const map = getPendingMap(metadata);
  const pending = map[name] ?? { stepMetadata: {} };

  delete map[name];

  return pending;
}

export function ensureStaticDecoratorTarget(
  context: StaticMemberDecoratorContext,
  decoratorName: string,
): void {
  if (!context.static) {
    throw new StaticDecoratorTargetRequiredError(decoratorName);
  }
}

// ── Flow Resolution ──
// Resolves a FlowRef (IFlowDef or @Flow-decorated class) to an IFlowDef

function isFlowDef<TContext extends IFlowContext>(
  value: unknown,
): value is IFlowDef<TContext> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IFlowDef<TContext>).id === "string" &&
    Array.isArray((value as IFlowDef<TContext>).steps)
  );
}

export function resolveFlowRef<TContext extends IFlowContext>(
  ref: FlowRef<TContext>,
): IFlowDef<TContext> {
  if (typeof ref === "function") {
    const flowDef = (ref as FlowClass<TContext>).flowDef;

    if (isFlowDef<TContext>(flowDef)) {
      return flowDef;
    }

    throw new InvalidFlowReferenceError();
  }

  if (isFlowDef<TContext>(ref)) {
    return ref;
  }

  throw new InvalidFlowReferenceError();
}
