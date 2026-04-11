import { IFlowContext } from "../contracts";
import {
  StepCompensation,
  StepCompensationResult,
  StepCompensationStatus,
} from "./step-compensation";

export enum CompensatorStatus {
  Idle = "idle",
  Compensating = "compensating",
  Compensated = "compensated",
  CompensatedWithError = "compensated-with-error",
}

export enum CompensatorStrategy {
  FailFast = "fail-fast",
  BestEffort = "best-effort",
}

export type CompensatorRunResult = {
  status: CompensatorStatus;
  errors: unknown[];
  compensationResults: StepCompensationResult[];
};

export type CompensatorRunOptions = {
  runStrategy?: CompensatorStrategy;
};

export class Compensator<
  TContext extends IFlowContext = IFlowContext,
> {
  protected registeredStepCompensations: StepCompensation<TContext>[] = [];
  protected status: CompensatorStatus = CompensatorStatus.Idle;
  protected lastRunResult?: CompensatorRunResult;

  registerCompensation(compensation: StepCompensation<TContext>) {
    this.registeredStepCompensations.push(compensation);
  }

  getStatus() {
    return this.status;
  }

  getLastRunResult() {
    return this.lastRunResult;
  }

  async compensate(
    context: TContext,
    options?: CompensatorRunOptions,
  ): Promise<CompensatorRunResult> {
    this.status = CompensatorStatus.Compensating;

    const runStrategy = options?.runStrategy ?? CompensatorStrategy.FailFast;
    const failedErrors: unknown[] = [];
    const compensationResults: StepCompensationResult[] = [];

    const reversedCompensations = this.registeredStepCompensations.toReversed();

    for (const compensation of reversedCompensations) {
      const compensationResult = await compensation.run(context);

      compensationResults.push(compensationResult);

      if (compensationResult.status === StepCompensationStatus.Failed) {
        failedErrors.push(compensationResult.error);

        if (runStrategy === CompensatorStrategy.FailFast) {
          this.status = CompensatorStatus.CompensatedWithError;

          const result = this.createRunResult(
            this.status,
            failedErrors,
            compensationResults,
          );

          this.lastRunResult = result;

          throw compensationResult.error;
        }
      }
    }

    this.status = failedErrors.length
      ? CompensatorStatus.CompensatedWithError
      : CompensatorStatus.Compensated;

    const result = this.createRunResult(
      this.status,
      failedErrors,
      compensationResults,
    );

    this.lastRunResult = result;

    return result;
  }

  protected createRunResult(
    status: CompensatorStatus,
    errors: unknown[],
    compensationResults: StepCompensationResult[],
  ): CompensatorRunResult {
    return {
      status,
      errors,
      compensationResults,
    };
  }
}
