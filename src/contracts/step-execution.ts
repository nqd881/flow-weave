import { InferredContext } from "./context-typed";
import { IFlowRuntime } from "./flow-runtime";
import { IStepDef } from "./step-def";
import { StepExecutionStatus } from "./step-execution-status";

export interface IStepExecution<TStep extends IStepDef = IStepDef> {
  readonly runtime: IFlowRuntime;
  readonly stepDef: TStep;
  readonly context: InferredContext<TStep>;

  getStatus(): StepExecutionStatus;
  getError(): unknown | undefined;

  isStopRequested(): boolean;
  throwIfStopRequested(): void;

  start(): Promise<void>;
  requestStop(): void;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
