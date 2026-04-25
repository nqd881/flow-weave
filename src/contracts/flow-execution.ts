import { IExecution } from "./execution";
import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { IStopControl } from "./stop-control";
import { IStepDef } from "./step-def";
import { IStepExecution } from "./step-execution";

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

export interface IFlowExecution<TFlowDef extends IFlowDef = IFlowDef>
  extends IExecution<FlowExecutionOutcome>, IStopControl {
  readonly id: string;
  readonly flowDef: TFlowDef;
  readonly context: InferredContext<TFlowDef>;

  createStepExecution<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecution<TStep>;
}
