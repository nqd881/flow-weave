import { ExecutionStatus } from "./execution-status";

export interface IExecution<TOutcome> {
  getStatus(): ExecutionStatus;
  getOutcome(): TOutcome | undefined;
  getError(): unknown | undefined;
  start(): Promise<void>;
}
