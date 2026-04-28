import { IFlowContext } from "../../contracts";
import { StepDefMetadata, SwitchStepDef } from "../../flow/step-defs";
import { Branch, Condition } from "../../flow/types";
import { FlowRef } from "./types";
import {
  addStepEntry,
  consumePending,
  ensureStaticDecoratorTarget,
  getNextStepOrder,
  resolveFlowRef,
} from "./metadata";

/**
 * @If(condition, trueFlow, elseFlow?) — static field decorator.
 * Compiles to the same SwitchStepDef shape used by the builder API.
 */
export function If<TContext extends IFlowContext = IFlowContext>(
  condition: Condition<TContext>,
  trueFlow: FlowRef<TContext>,
  elseFlow?: FlowRef<TContext>,
) {
  return (
    _target: undefined,
    context: ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "If");

    const pending = consumePending(context.metadata, context.name);
    const { stepMetadata, ...extensions } = pending;

    addStepEntry(context.metadata, {
      order: getNextStepOrder(),
      propertyKey: context.name,
      stepMetadata: stepMetadata as StepDefMetadata | undefined,
      build: (metadata) => {
        const cases = [
          {
            predicate: (value: boolean) => !!value,
            flow: resolveFlowRef(trueFlow),
          },
        ];
        const defaultBranch: Branch<TContext> | undefined = elseFlow
          ? { flow: resolveFlowRef(elseFlow) }
          : undefined;

        return new SwitchStepDef<TContext, boolean>(
          condition,
          cases,
          defaultBranch,
          metadata,
        );
      },
      extensions,
    });
  };
}
