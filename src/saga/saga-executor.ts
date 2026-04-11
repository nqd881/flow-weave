import {
  IFlowDef,
  IFlowExecution,
  IStepExecution,
  StepExecutionStatus,
} from "../contracts";
import { FlowExecutor } from "../flow";
import { StepCompensation } from "./step-compensation";
import { SagaExecution } from "./saga-execution";

export class SagaExecutor<
  TSagaFlow extends IFlowDef,
> extends FlowExecutor<TSagaFlow> {
  override beforeStepStart(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution,
  ): void {
    // No-op hook for now
  }

  override afterStepFinished(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution,
  ): void {
    const sagaExecution = flowExecution as SagaExecution;

    if (stepExecution.getStatus() === StepExecutionStatus.Completed) {
      const flowDef = sagaExecution.flowDef;
      const stepId = stepExecution.stepDef.id;

      if (sagaExecution.isCommitted()) return;

      if (flowDef.stepCompensationActionMap.has(stepId)) {
        sagaExecution.registerCompensation(
          new StepCompensation(
            stepId,
            flowDef.stepCompensationActionMap.get(stepId)!,
          ),
        );
      }

      if (stepId === flowDef.pivotStepId) {
        sagaExecution.commit();
      }
    }
  }
}
