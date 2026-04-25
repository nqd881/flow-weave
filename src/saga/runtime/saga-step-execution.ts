import {
  IFlowContext,
  InferredContext,
  IStepDef,
  IStepExecutor,
  StepExecutionOutcomeKind,
} from "../../contracts";
import { StepHooks } from "../../flow/step-defs/step-metadata";
import { BaseExecution } from "../../runtime/execution/base-execution";
import { CreateFlowExecution } from "../../runtime/execution/create-child-flow-execution";
import { StepExecution } from "../../runtime/execution/step-execution";
import { SagaDef } from "../saga-def";
import { StepCompensation } from "../step-compensation";
import { SagaExecution } from "./saga-execution";

type SagaStepExecutionOptions<
  TContext extends IFlowContext = IFlowContext,
> = {
  flowHooks?: StepHooks<TContext>;
};

export class SagaStepExecution<
  TStep extends IStepDef,
  TSagaFlow extends SagaDef = SagaDef,
> extends StepExecution<TStep> {
  constructor(
    protected readonly sagaExecution: SagaExecution<TSagaFlow>,
    createFlowExecution: CreateFlowExecution,
    executor: IStepExecutor<TStep>,
    stepDef: TStep,
    context: InferredContext<TStep>,
    options?: SagaStepExecutionOptions<InferredContext<TStep>>,
    parentExecution?: BaseExecution,
  ) {
    super(
      createFlowExecution,
      executor,
      stepDef,
      context,
      options,
      parentExecution,
    );
  }

  protected override async afterFinish(): Promise<void> {
    const stepOutcomeKind = this.getOutcome()?.kind;
    const stepError = this.getError();

    if (
      stepOutcomeKind === StepExecutionOutcomeKind.Completed ||
      stepOutcomeKind === StepExecutionOutcomeKind.Recovered
    ) {
      const flowDef = this.sagaExecution.flowDef;
      const stepId = this.stepDef.id;

      if (this.sagaExecution.isCommitted()) return;

      if (
        stepOutcomeKind === StepExecutionOutcomeKind.Completed &&
        flowDef.stepCompensationActionMap.has(stepId)
      ) {
        this.sagaExecution.registerCompensation(
          new StepCompensation(
            stepId,
            flowDef.stepCompensationActionMap.get(stepId)!,
          ),
        );
      }

      if (stepId === flowDef.pivotStepId && !stepError) {
        this.sagaExecution.commit();
      }
    }
  }
}
