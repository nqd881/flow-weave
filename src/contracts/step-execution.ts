import { IExecution } from "./execution";
import { ExecutionStatus } from "./execution-status";
import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IStopControl } from "./stop-control";
import { IStepDef } from "./step-def";

export enum StepExecutionFailureSource {
  PreHook = "pre-hook",
  Execute = "execute",
  Recover = "recover",
}

export enum StepExecutionOutcomeKind {
  Completed = "completed",
  Recovered = "recovered",
  Failed = "failed",
  Stopped = "stopped",
}

export abstract class StepExecutionOutcome<
  TKind extends StepExecutionOutcomeKind = StepExecutionOutcomeKind,
> {
  abstract readonly kind: TKind;
}

export class StepExecutionCompletedOutcome extends StepExecutionOutcome<StepExecutionOutcomeKind.Completed> {
  readonly kind = StepExecutionOutcomeKind.Completed;
}

export class StepExecutionRecoveredOutcome extends StepExecutionOutcome<StepExecutionOutcomeKind.Recovered> {
  readonly kind = StepExecutionOutcomeKind.Recovered;

  constructor(
    public readonly cause: unknown,
    public readonly failureSource: StepExecutionFailureSource,
  ) {
    super();
  }
}

export class StepExecutionFailedOutcome extends StepExecutionOutcome<StepExecutionOutcomeKind.Failed> {
  readonly kind = StepExecutionOutcomeKind.Failed;

  constructor(
    public readonly error: unknown,
    public readonly failureSource: StepExecutionFailureSource,
  ) {
    super();
  }
}

export class StepExecutionStoppedOutcome extends StepExecutionOutcome<StepExecutionOutcomeKind.Stopped> {
  readonly kind = StepExecutionOutcomeKind.Stopped;
}

export type StepExecutionInfo = {
  stepId: string;
  stepType: string;
  status: ExecutionStatus;
  outcome?: StepExecutionOutcome;
};

export type StepExecutionFailureInfo = {
  stepId: string;
  stepType: string;
  failureSource: StepExecutionFailureSource;
};

export interface IStepExecution<TStep extends IStepDef = IStepDef>
  extends IExecution<StepExecutionOutcome>, IStopControl {
  readonly stepDef: TStep;
  readonly context: InferredContext<TStep>;

  createChildFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;
}
