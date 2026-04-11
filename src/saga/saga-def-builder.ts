import { IFlowContext } from "../contracts";
import { v4 } from "uuid";
import { FlowDefBuilder } from "../authoring/flow-def-builder";
import { StepCompensationAction } from "./step-compensation";
import { StepCompensationActionMap } from "./step-compensation-action-map";
import { SagaDef } from "./saga-def";
import { SagaDefMetadata } from "./saga-metadata";

export class SagaDefBuilder<
  TWeaver,
  TContext extends IFlowContext = IFlowContext,
> extends FlowDefBuilder<TWeaver, TContext> {
  declare protected metadata?: SagaDefMetadata<TContext>;
  protected pendingStepCompensationActionsByIndex = new Map<
    number,
    StepCompensationAction<TContext>
  >();
  protected commitPoint?: number;

  compensateWith(action: StepCompensationAction<TContext>) {
    this.flushStepDraft();

    const lastStepIndex = this.steps.length - 1;

    if (lastStepIndex < 0) throw new Error("No step to compensate.");

    this.pendingStepCompensationActionsByIndex.set(lastStepIndex, action);

    return this;
  }

  commit() {
    this.flushStepDraft();

    if (this.commitPoint === undefined) {
      this.commitPoint = this.steps.length - 1;
    }

    return this;
  }

  override build() {
    this.flushStepDraft();

    const steps = this.buildSteps();
    const sagaId = this.id ?? v4();

    const stepCompensationActionMap = new StepCompensationActionMap<TContext>();

    this.pendingStepCompensationActionsByIndex.forEach(
      (compensationAction, stepIndex) => {
        stepCompensationActionMap.set(steps[stepIndex]!.id, compensationAction);
      },
    );

    const pivotStepId =
      this.commitPoint !== undefined ? steps[this.commitPoint]!.id : undefined;

    return new SagaDef<TContext>(
      sagaId,
      steps,
      stepCompensationActionMap,
      pivotStepId,
      this.metadata,
    );
  }
}
