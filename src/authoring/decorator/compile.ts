import { IFlowContext } from "../../contracts";
import { FlowDef, FlowDefMetadata } from "../../flow";
import { StepEntry } from "./types";
import { getOwnSteps } from "./metadata";

function getStaticMemberOrder(
  target: Function,
): Map<string, number> {
  const order = new Map<string, number>();
  const classSource = Function.prototype.toString.call(target);
  const staticMemberPattern = /static\s+(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(?=\(|=|;)/g;

  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = staticMemberPattern.exec(classSource)) !== null) {
    const name = match[1]!;

    if (!order.has(name)) {
      order.set(name, index++);
    }
  }

  return order;
}

function getEntrySortOrder(
  entry: StepEntry,
  memberOrder?: Map<string, number>,
): number {
  if (typeof entry.propertyKey === "string") {
    return memberOrder?.get(entry.propertyKey) ?? entry.order;
  }

  return entry.order;
}

/**
 * Compiles accumulated step entries into a FlowDef.
 * Called by @Flow class decorator after all member decorators have run.
 */
export function compileFlowDef<TContext extends IFlowContext>(
  id: string,
  metadata: DecoratorMetadata,
  flowMetadata?: FlowDefMetadata<TContext>,
  target?: Function,
): FlowDef<TContext> {
  const entries = getSortedStepEntries(metadata, target);

  // Build each entry into a StepDef
  const steps = entries.map((entry) => entry.build(entry.stepMetadata));

  return new FlowDef<TContext>(id, steps, flowMetadata);
}

/**
 * Returns the sorted step entries without compiling them.
 * Useful for custom class decorators (like @Saga) that need
 * to inspect step extensions before compilation.
 */
export function getSortedStepEntries(
  metadata: DecoratorMetadata,
  target?: Function,
): StepEntry[] {
  const entries = getOwnSteps(metadata);
  const memberOrder = target ? getStaticMemberOrder(target) : undefined;

  return [...entries].sort(
    (a, b) => getEntrySortOrder(a, memberOrder) - getEntrySortOrder(b, memberOrder),
  );
}
