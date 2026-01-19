import { IClient } from "./client";
import { InferredContext } from "./flow-def";
import { IStepDef } from "./step-def";
import { StepExecutionStatus } from "./step-execution-status";

export interface IStepExecution<TStep extends IStepDef = IStepDef> {
  readonly client: IClient;
  readonly stepDef: TStep;
  readonly context: InferredContext<TStep>;

  getStatus(): StepExecutionStatus;
  getError(): unknown | undefined;
  isStopRequested(): boolean;

  start(): Promise<void>;
  requestStop(): void;
  waitUntilFinished(): Promise<void>;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
