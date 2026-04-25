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

function throwForUnsupportedBreak() {
  throw new UnsupportedParallelBreakError();
}

function throwForSettledExecution(execution: IFlowExecution) {
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

async function waitForNextSettledExecution(
  pendingExecutionSettlements: Map<string, Promise<ParallelExecutionSettlement>>,
) {
  const settlement = await Promise.race(pendingExecutionSettlements.values());
  pendingExecutionSettlements.delete(settlement.execution.id);
  return settlement;
}

function requestStopOnOtherExecutions(
  executions: IFlowExecution[],
  winnerExecutionId: string,
) {
  executions.forEach((execution) => {
    if (execution.id !== winnerExecutionId) {
      execution.requestStop();
    }
  });
}

function hasBreakSettlement(settlements: ParallelExecutionSettlement[]) {
  return settlements.some(
    (settlement) => settlement.error instanceof BreakLoopSignal,
  );
}

export async function coordinateParallelExecutions(
  executions: IFlowExecution[],
  strategy: ParallelStepStrategy,
) {
  if (!executions.length) {
    return;
  }

  const executionSettlementPromises = executions.map((execution) =>
    execution
      .start()
      .then(() => ({ execution }))
      .catch((error) => ({ execution, error })),
  );

  if (strategy === ParallelStepStrategy.AllSettled) {
    const settlements = await Promise.all(executionSettlementPromises);

    if (hasBreakSettlement(settlements)) {
      throwForUnsupportedBreak();
    }

    return;
  }

  const pendingExecutionSettlements = new Map(
    executionSettlementPromises.map((settlementPromise, index) => [
      executions[index]!.id,
      settlementPromise,
    ]),
  );

  let firstFailedExecution: IFlowExecution | undefined;
  let firstStoppedExecution: IFlowExecution | undefined;

  while (pendingExecutionSettlements.size) {
    const settlement = await waitForNextSettledExecution(
      pendingExecutionSettlements,
    );
    const { execution, error } = settlement;
    const outcomeKind = execution.getOutcome()?.kind;

    if (error instanceof BreakLoopSignal) {
      requestStopOnOtherExecutions(executions, execution.id);
      await Promise.all(executionSettlementPromises);
      throwForUnsupportedBreak();
    }

    switch (strategy) {
      case ParallelStepStrategy.FailFast: {
        if (outcomeKind === FlowExecutionOutcomeKind.Completed) {
          continue;
        }

        requestStopOnOtherExecutions(executions, execution.id);
        await Promise.all(executionSettlementPromises);
        throwForSettledExecution(execution);
        return;
      }

      case ParallelStepStrategy.FirstSettled: {
        requestStopOnOtherExecutions(executions, execution.id);
        await Promise.all(executionSettlementPromises);
        throwForSettledExecution(execution);
        return;
      }

      case ParallelStepStrategy.FirstCompleted: {
        if (outcomeKind === FlowExecutionOutcomeKind.Completed) {
          requestStopOnOtherExecutions(executions, execution.id);
          await Promise.all(executionSettlementPromises);
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

        if (!pendingExecutionSettlements.size) {
          if (firstFailedExecution) {
            throwForSettledExecution(firstFailedExecution);
          }

          if (firstStoppedExecution) {
            throwForSettledExecution(firstStoppedExecution);
          }
        }

        break;
      }
    }
  }
}
