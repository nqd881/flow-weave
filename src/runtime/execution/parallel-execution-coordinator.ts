import {
  FlowExecutionFailedOutcome,
  FlowExecutionOutcomeKind,
  IFlowExecution,
} from "../../contracts";
import { ParallelStepStrategy } from "../../flow/types";
import { UnsupportedParallelBreakError } from "../execution-errors";
import { BreakLoopSignal, StopSignal } from "../execution-signals";

type ParallelExecutionSettlement = {
  execution: IFlowExecution;
  error?: unknown;
};

export class ParallelExecutionCoordinator {
  protected readonly executionSettlementPromises: Promise<ParallelExecutionSettlement>[];
  protected readonly pendingExecutionSettlements: Map<
    string,
    Promise<ParallelExecutionSettlement>
  >;

  constructor(
    protected readonly executions: IFlowExecution[],
    protected readonly strategy: ParallelStepStrategy,
  ) {
    this.executionSettlementPromises = executions.map((execution) =>
      execution
        .start()
        .then(() => ({ execution }))
        .catch((error) => ({ execution, error })),
    );

    this.pendingExecutionSettlements = new Map(
      this.executionSettlementPromises.map((settlementPromise, index) => [
        executions[index]!.id,
        settlementPromise,
      ]),
    );
  }

  async run() {
    if (!this.executions.length) {
      return;
    }

    switch (this.strategy) {
      case ParallelStepStrategy.AllSettled: {
        const settlements = await this.collectAllSettlements();

        this.throwForUnsupportedBreakSettlement(settlements);
        return;
      }

      case ParallelStepStrategy.AllCompleted: {
        const settlements = await this.collectAllSettlements();

        this.throwForUnsupportedBreakSettlement(settlements);
        this.throwForAllCompletedSettlements(settlements);
        return;
      }

      case ParallelStepStrategy.FailFast:
      case ParallelStepStrategy.FirstSettled:
      case ParallelStepStrategy.FirstCompleted: {
        let firstFailedExecution: IFlowExecution | undefined;
        let firstStoppedExecution: IFlowExecution | undefined;

        while (this.pendingExecutionSettlements.size) {
          const settlement = await this.waitForNextSettledExecution();
          const { execution, error } = settlement;
          const outcomeKind = execution.getOutcome()?.kind;

          if (error instanceof BreakLoopSignal) {
            this.requestStopOnOtherExecutions(execution.id);
            await this.collectAllSettlements();
            this.throwForUnsupportedBreak();
          }

          switch (this.strategy) {
            case ParallelStepStrategy.FailFast: {
              if (outcomeKind === FlowExecutionOutcomeKind.Completed) {
                continue;
              }

              this.requestStopOnOtherExecutions(execution.id);
              await this.collectAllSettlements();
              this.throwForSettledExecution(execution);
              return;
            }

            case ParallelStepStrategy.FirstSettled: {
              this.requestStopOnOtherExecutions(execution.id);
              await this.collectAllSettlements();
              this.throwForSettledExecution(execution);
              return;
            }

            case ParallelStepStrategy.FirstCompleted: {
              if (outcomeKind === FlowExecutionOutcomeKind.Completed) {
                this.requestStopOnOtherExecutions(execution.id);
                await this.collectAllSettlements();
                return;
              }

              if (
                outcomeKind === FlowExecutionOutcomeKind.Failed &&
                !firstFailedExecution
              ) {
                firstFailedExecution = execution;
              }

              if (
                outcomeKind === FlowExecutionOutcomeKind.Stopped &&
                !firstStoppedExecution
              ) {
                firstStoppedExecution = execution;
              }

              if (!this.pendingExecutionSettlements.size) {
                if (firstFailedExecution) {
                  this.throwForSettledExecution(firstFailedExecution);
                }

                if (firstStoppedExecution) {
                  this.throwForSettledExecution(firstStoppedExecution);
                }
              }

              break;
            }
          }
        }
      }
    }
  }

  protected async collectAllSettlements() {
    return Promise.all(this.executionSettlementPromises);
  }

  protected async waitForNextSettledExecution() {
    const settlement = await Promise.race(this.pendingExecutionSettlements.values());

    this.pendingExecutionSettlements.delete(settlement.execution.id);
    return settlement;
  }

  protected requestStopOnOtherExecutions(winnerExecutionId: string) {
    this.executions.forEach((execution) => {
      if (execution.id !== winnerExecutionId) {
        execution.requestStop();
      }
    });
  }

  protected throwForUnsupportedBreakSettlement(
    settlements: ParallelExecutionSettlement[],
  ) {
    if (
      settlements.some((settlement) => settlement.error instanceof BreakLoopSignal)
    ) {
      this.throwForUnsupportedBreak();
    }
  }

  protected throwForAllCompletedSettlements(
    settlements: ParallelExecutionSettlement[],
  ) {
    for (const settlement of settlements) {
      if (
        settlement.execution.getOutcome()?.kind ===
        FlowExecutionOutcomeKind.Failed
      ) {
        this.throwForSettledExecution(settlement.execution);
      }
    }

    for (const settlement of settlements) {
      if (
        settlement.execution.getOutcome()?.kind ===
        FlowExecutionOutcomeKind.Stopped
      ) {
        this.throwForSettledExecution(settlement.execution);
      }
    }
  }

  protected throwForUnsupportedBreak(): never {
    throw new UnsupportedParallelBreakError();
  }

  protected throwForSettledExecution(execution: IFlowExecution) {
    const outcome = execution.getOutcome();

    switch (outcome?.kind) {
      case FlowExecutionOutcomeKind.Completed: {
        return;
      }
      case FlowExecutionOutcomeKind.Failed: {
        if (outcome instanceof FlowExecutionFailedOutcome) {
          throw outcome.error;
        }

        throw execution.getError();
      }
      case FlowExecutionOutcomeKind.Stopped: {
        throw new StopSignal();
      }
    }
  }
}
