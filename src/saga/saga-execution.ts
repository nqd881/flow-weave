import {
  FlowExecutionOutcomeKind,
  FlowExecutionStatus,
  IFlowExecution,
  InferredContext,
} from "../contracts";
import { FlowExecution } from "../flow";
import { StepCompensation } from "./step-compensation";
import { Compensator, CompensatorStatus } from "./compensator";
import { SagaDef } from "./saga-def";
import { SagaStatus } from "./saga-status";

export class SagaExecution<TFlowDef extends SagaDef = SagaDef>
  extends FlowExecution<TFlowDef>
  implements IFlowExecution
{
  protected committed = false;
  protected compensator = new Compensator<InferredContext<TFlowDef>>();

  protected override async finalizeAfterFinish(): Promise<void> {
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
    if (this.status === FlowExecutionStatus.Pending) {
      return SagaStatus.Pending;
    }

    if (this.status === FlowExecutionStatus.Running) {
      return SagaStatus.Running;
    }

    if (this.status !== FlowExecutionStatus.Finished) {
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
