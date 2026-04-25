import {
  ExecutionStatus,
  FlowExecutionOutcomeKind,
  InferredContext,
} from "../../contracts";
import { Compensator, CompensatorStatus } from "../compensator";
import { SagaDef } from "../saga-def";
import { SagaStatus } from "../saga-status";
import { StepCompensation } from "../step-compensation";
import { FlowExecution } from "../../runtime/execution/flow-execution";

export class SagaExecution<TFlowDef extends SagaDef = SagaDef>
  extends FlowExecution<TFlowDef> {
  protected committed = false;
  protected compensator = new Compensator<InferredContext<TFlowDef>>();

  protected override async afterFinish(): Promise<void> {
    if (this.isCommitted()) return;

    const outcomeKind = this.getOutcome()?.kind;

    if (
      outcomeKind === FlowExecutionOutcomeKind.Failed ||
      outcomeKind === FlowExecutionOutcomeKind.Stopped
    ) {
      await Promise.resolve(
        this.compensator.compensate(this.context, {
          runStrategy: this.flowDef.compensatorStrategy,
        }),
      );
    }
  }

  isCommitted() {
    return this.committed;
  }

  commit() {
    this.committed = true;
  }

  registerCompensation(
    compensation: StepCompensation<InferredContext<TFlowDef>>,
  ) {
    if (this.committed) return;

    this.compensator.registerCompensation(compensation);
  }

  getSagaStatus(): SagaStatus {
    if (this.status === ExecutionStatus.Pending) {
      return SagaStatus.Pending;
    }

    if (this.status === ExecutionStatus.Running) {
      return SagaStatus.Running;
    }

    if (this.status !== ExecutionStatus.Finished) {
      return SagaStatus.CompletedWithError;
    }

    if (this.getOutcome()?.kind === FlowExecutionOutcomeKind.Completed) {
      return SagaStatus.Completed;
    }

    if (this.committed) {
      return SagaStatus.CompletedWithError;
    }

    const compensatorStatus = this.compensator.getStatus();

    if (compensatorStatus === CompensatorStatus.Compensating) {
      return SagaStatus.Compensating;
    }

    if (compensatorStatus === CompensatorStatus.CompensatedWithError) {
      return SagaStatus.CompensatedWithError;
    }

    if (compensatorStatus === CompensatorStatus.Compensated) {
      return SagaStatus.Compensated;
    }

    return SagaStatus.Compensating;
  }
}
