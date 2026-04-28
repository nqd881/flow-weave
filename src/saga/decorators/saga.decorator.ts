import { IFlowContext } from "../../contracts";
import {
  ensureStaticDecoratorTarget,
  getPendingForMember,
} from "../../authoring/decorator/metadata";
import { getSortedStepEntries } from "../../authoring/decorator/compile";
import { WithFlowDef } from "../../authoring/decorator/types";
import { SagaDef } from "../saga-def";
import { SagaDefMetadata } from "../saga-metadata";
import { StepCompensationAction } from "../step-compensation";
import { StepCompensationActionMap } from "../step-compensation-action-map";

const COMPENSATION_ACTION_KEY = "flow-weave:saga:compensation-action";
const COMMIT_POINT_KEY = "flow-weave:saga:commit-point";

export function CompensateWith<
  TContext extends IFlowContext = IFlowContext,
>(action: StepCompensationAction<TContext>) {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "CompensateWith");

    const pending = getPendingForMember(context.metadata, context.name);
    pending[COMPENSATION_ACTION_KEY] = action;
  };
}

export function CommitPoint() {
  return (
    _target: any,
    context: ClassMethodDecoratorContext | ClassFieldDecoratorContext,
  ) => {
    ensureStaticDecoratorTarget(context, "CommitPoint");

    const pending = getPendingForMember(context.metadata, context.name);
    pending[COMMIT_POINT_KEY] = true;
  };
}

export function Saga<TContext extends IFlowContext = IFlowContext>(
  id?: string,
  metadata?: SagaDefMetadata<TContext>,
) {
  return <TTarget extends abstract new (...args: any[]) => unknown>(
    target: TTarget,
    context: ClassDecoratorContext<TTarget>,
  ): WithFlowDef<TTarget, SagaDef<TContext>> => {
    const entries = getSortedStepEntries(context.metadata, target);
    const steps = entries.map((entry) => entry.build(entry.stepMetadata));
    const stepCompensationActionMap = new StepCompensationActionMap<TContext>();

    let pivotStepId: string | undefined;

    for (const [index, entry] of entries.entries()) {
      const step = steps[index]!;
      const compensationAction = entry.extensions[
        COMPENSATION_ACTION_KEY
      ] as StepCompensationAction<TContext> | undefined;

      if (compensationAction) {
        stepCompensationActionMap.set(step.id, compensationAction);
      }

      if (
        pivotStepId === undefined &&
        entry.extensions[COMMIT_POINT_KEY] === true
      ) {
        pivotStepId = step.id;
      }
    }

    const sagaId = id ?? context.name ?? "unnamed-saga";
    const sagaDef = new SagaDef<TContext>(
      sagaId,
      steps,
      stepCompensationActionMap,
      pivotStepId,
      metadata,
    );

    Object.defineProperty(target, "flowDef", {
      value: sagaDef,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return target as WithFlowDef<TTarget, SagaDef<TContext>>;
  };
}
