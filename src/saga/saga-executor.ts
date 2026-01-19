import {
  IFlowDef,
  IFlowExecution,
  IStepExecution,
  StepExecutionStatus,
} from "../abstraction";
import { FlowExecutor } from "../base/flow-executor";
import { SagaExecution } from "./saga-execution";

export class SagaExecutor<
  TSagaFlow extends IFlowDef
> extends FlowExecutor<TSagaFlow> {
  override beforeStepStart(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution
  ): void {
    // No-op hook for now
  }

  override afterStepFinished(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution
  ): void {
    const sagaExecution = flowExecution as SagaExecution;

    if (stepExecution.getStatus() === StepExecutionStatus.Completed) {
      const flowDef = sagaExecution.flowDef;
      const stepId = stepExecution.stepDef.id;

      if (sagaExecution.isCommitted()) return;

      if (flowDef.compensationMap.has(stepId)) {
        sagaExecution.registerCompensation(
          flowDef.compensationMap.get(stepId)!
        );
      }

      if (stepId === flowDef.pivotStepId) {
        sagaExecution.commit();
      }
    }
  }
}
