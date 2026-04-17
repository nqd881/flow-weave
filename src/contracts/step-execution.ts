import { InferredContext } from "./context-typed";
import { IFlowRuntime } from "./flow-runtime";
import { IStepDef } from "./step-def";
import { StepExecutionStatus } from "./step-execution-status";

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
  status: StepExecutionStatus;
  outcome?: StepExecutionOutcome;
};

export type StepExecutionFailureInfo = {
  stepId: string;
  stepType: string;
  failureSource: StepExecutionFailureSource;
};

export interface IStepExecution<TStep extends IStepDef = IStepDef> {
  readonly runtime: IFlowRuntime;
  readonly stepDef: TStep;
  readonly context: InferredContext<TStep>;

  getStatus(): StepExecutionStatus;
  getOutcome(): StepExecutionOutcome | undefined;
  getError(): unknown | undefined;

  isStopRequested(): boolean;
  throwIfStopRequested(): void;

  start(): Promise<void>;
  requestStop(): void;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
