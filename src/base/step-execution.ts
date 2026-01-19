import {
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepExecutionStatus,
} from "../abstraction";
import { IClient } from "../abstraction/client";

export class StepStoppedError extends Error {
  constructor() {
    super("Step execution was stopped.");
  }
}

export class StepExecution<TStep extends IStepDef>
  implements IStepExecution<TStep>
{
  protected status: StepExecutionStatus = StepExecutionStatus.Pending;
  protected stopRequested = false;
  protected error?: unknown;

  protected finished = Promise.withResolvers<void>();

  protected onStopRequestedActions: Array<() => any> = [];
  protected onFinishedActions: Array<() => any> = [];

  constructor(
    public readonly client: IClient,
    public readonly executor: IStepExecutor<TStep>,
    public readonly stepDef: TStep,
    public readonly context: any
  ) {}

  getStatus() {
    return this.status;
  }

  getError() {
    return this.error;
  }

  isStopRequested() {
    return this.stopRequested;
  }

  isPending() {
    return this.status === StepExecutionStatus.Pending;
  }

  isRunning() {
    return this.status === StepExecutionStatus.Running;
  }

  isCompleted() {
    return this.status === StepExecutionStatus.Completed;
  }

  isFailed() {
    return this.status === StepExecutionStatus.Failed;
  }

  isStopped() {
    return this.status === StepExecutionStatus.Stopped;
  }

  isFinished() {
    return this.isCompleted() || this.isFailed() || this.isStopped();
  }

  async start() {
    if (this.status !== StepExecutionStatus.Pending) throw new Error();

    try {
      this.status = StepExecutionStatus.Running;

      await this.executor.execute(this);

      this.status = StepExecutionStatus.Completed;
    } catch (error) {
      if (error instanceof StepStoppedError) {
        this.status = StepExecutionStatus.Stopped;
      } else {
        this.error = error;
        this.status = StepExecutionStatus.Failed;

        throw error;
      }
    } finally {
      this.runActions(this.onFinishedActions);

      this.finished.resolve();
    }
  }

  requestStop() {
    if (!this.stopRequested) {
      this.stopRequested = true;

      this.runActions(this.onStopRequestedActions);
    }
  }

  async waitUntilFinished(): Promise<void> {
    return this.finished.promise;
  }

  protected runActions(actions: Array<() => any>) {
    for (const action of actions) {
      action();
    }
  }

  onStopRequested(action: () => any) {
    this.onStopRequestedActions.push(action);
  }

  onFinished(action: () => any) {
    this.onFinishedActions.push(action);
  }
}
