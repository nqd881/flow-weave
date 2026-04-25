import assert from "assert/strict";
import {
  ExecutionStatus,
  FlowExecutionOutcomeKind,
  IFlowExecution,
  SagaExecution,
} from "../../src";

export function asSagaExecution<T extends SagaExecution>(execution: unknown): T {
  return execution as T;
}

export function assertFlowOutcome(
  execution: IFlowExecution,
  expectedOutcome: FlowExecutionOutcomeKind,
) {
  assert.equal(execution.getStatus(), ExecutionStatus.Finished);
  assert.equal(execution.getOutcome()?.kind, expectedOutcome);
}
