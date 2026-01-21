import { IFlowExecutionContext } from "../abstraction";
import { FlowDefBuilder } from "../base";
import { Compensation } from "./compensation";
import { CompensationMap } from "./compensation-map";
import { SagaDef } from "./saga-def";

export class SagaDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends FlowDefBuilder<TBuilderClient, TContext> {
  protected preCompensationMap = new Map<number, Compensation<TContext>>();
  protected commitPoint?: number;

  compensateWith(action: Compensation<TContext>) {
    const lastStepIndex = this.steps.length - 1;

    if (lastStepIndex < 0) throw new Error("No step to compensate.");

    this.preCompensationMap.set(lastStepIndex, action);

    return this;
  }

  commit() {
    if (this.commitPoint === undefined) {
      this.commitPoint = this.steps.length - 1;
    }

    return this;
  }

  override build() {
    const steps = this.buildSteps();

    const compensationMap = new CompensationMap<TContext>();

    this.preCompensationMap.forEach((compensationAction, stepIndex) => {
      compensationMap.set(steps[stepIndex]!.id, compensationAction);
    });

    const pivotStepId = this.commitPoint
      ? steps[this.commitPoint]!.id
      : undefined;

    return new SagaDef<TContext>(steps, compensationMap, pivotStepId);
  }
}
