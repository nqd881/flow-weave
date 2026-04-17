import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { FlowExecutionStatus } from "./flow-execution-status";
import { IFlowRuntime } from "./flow-runtime";

export enum FlowExecutionOutcomeKind {
  Completed = "completed",
  Failed = "failed",
  Stopped = "stopped",
}

export abstract class FlowExecutionOutcome<
  TKind extends FlowExecutionOutcomeKind = FlowExecutionOutcomeKind,
> {
  abstract readonly kind: TKind;
}

export class FlowExecutionCompletedOutcome extends FlowExecutionOutcome<FlowExecutionOutcomeKind.Completed> {
  readonly kind = FlowExecutionOutcomeKind.Completed;
}

export class FlowExecutionFailedOutcome extends FlowExecutionOutcome<FlowExecutionOutcomeKind.Failed> {
  readonly kind = FlowExecutionOutcomeKind.Failed;

  constructor(public readonly error: unknown) {
    super();
  }
}

export class FlowExecutionStoppedOutcome extends FlowExecutionOutcome<FlowExecutionOutcomeKind.Stopped> {
  readonly kind = FlowExecutionOutcomeKind.Stopped;
}

export interface IFlowExecution<TFlowDef extends IFlowDef = IFlowDef> {
  readonly id: string;
  readonly runtime: IFlowRuntime;
  readonly flowDef: TFlowDef;
  readonly context: InferredContext<TFlowDef>;

  getStatus(): FlowExecutionStatus;
  getOutcome(): FlowExecutionOutcome | undefined;
  getError(): unknown | undefined;

  isStopRequested(): boolean;

  start(): Promise<void>;
  requestStop(): void;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
