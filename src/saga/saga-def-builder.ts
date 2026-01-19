import { IFlowExecutionContext } from "../abstraction";
import { IFlowBuilderClient, FlowDefBuilder } from "../base/flow-def-builder";
import { Compensation } from "./compensation";
import { CompensationMap } from "./compensation-map";
import { SagaDef } from "./saga-def";

export class SagaDefBuilder<
  TClient extends IFlowBuilderClient = IFlowBuilderClient,
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> extends FlowDefBuilder<TClient, TContext> {
  protected preCompensationMap = new Map<number, Compensation>();
  protected commitPoint?: number;

  constructor(client: TClient) {
    super(client);
  }

  compensateWith(action: Compensation) {
    const lastStepIndex = this.steps.length - 1;

    if (lastStepIndex < 0) throw new Error("No step to compensate.");

    this.preCompensationMap.set(lastStepIndex, action);

    return this;
  }

  commit() {
    if (!this.commitPoint) this.commitPoint = this.steps.length - 1;

    return this;
  }

  override build() {
    const steps = this.buildSteps();

    const compensationMap = new CompensationMap();

    this.preCompensationMap.forEach((compensationAction, stepIndex) => {
      compensationMap.set(steps[stepIndex]!.id, compensationAction);
    });

    const pivotStepId = this.commitPoint
      ? steps[this.commitPoint]!.id
      : undefined;

    return new SagaDef<TContext>(steps, compensationMap, pivotStepId);
  }
}
