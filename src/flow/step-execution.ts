import {
  IFlowContext,
  IFlowRuntime,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepExecutionStatus,
} from "../contracts";
import { StepDefWithHooks, StepHook, StepHooks } from "./step-defs";

export class StepStoppedError extends Error {
  constructor() {
    super("Step execution was stopped.");
  }
}

type StepExecutionOptions<
  TContext extends IFlowContext = IFlowContext,
> = {
  flowHooks?: StepHooks<TContext>;
};

export class StepExecution<
  TStep extends IStepDef,
> implements IStepExecution<TStep> {
  protected status: StepExecutionStatus = StepExecutionStatus.Pending;
  protected stopRequested = false;
  protected error?: unknown;

  protected onStopRequestedActions: Array<() => any> = [];
  protected onFinishedActions: Array<() => any> = [];

  constructor(
    public readonly runtime: IFlowRuntime,
    public readonly executor: IStepExecutor<TStep>,
    public readonly stepDef: TStep,
    public readonly context: InferredContext<TStep>,
    protected readonly options?: StepExecutionOptions<InferredContext<TStep>>,
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

  throwIfStopRequested() {
    if (this.stopRequested) {
      throw new StepStoppedError();
    }
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

    let executeError: unknown;

    try {
      this.status = StepExecutionStatus.Running;

      await this.runStepHooks(this.getPreHooks());

      await this.executor.execute(this);

      this.status = StepExecutionStatus.Completed;
    } catch (error) {
      executeError = error;

      if (error instanceof StepStoppedError) {
        this.status = StepExecutionStatus.Stopped;
      } else {
        this.error = error;
        this.status = StepExecutionStatus.Failed;
      }
    } finally {
      const postError = await this.runPostHooks(executeError);

      this.runActions(this.onFinishedActions);

      if (executeError) {
        throw executeError;
      }

      if (postError) {
        this.error = postError;
        this.status = StepExecutionStatus.Failed;
        throw postError;
      }
    }
  }

  requestStop() {
    if (!this.stopRequested) {
      this.stopRequested = true;

      this.runActions(this.onStopRequestedActions);
    }
  }

  protected runActions(actions: Array<() => any>) {
    for (const action of actions) {
      action();
    }
  }

  protected async runPostHooks(error?: unknown) {
    try {
      await this.runStepHooks(this.getPostHooks(), error);
    } catch (postError) {
      return postError;
    }
  }

  protected async runStepHooks(
    hooks: StepHook<InferredContext<TStep>>[] = [],
    error?: unknown,
  ) {
    if (!hooks?.length) return;

    for (const hook of hooks) {
      await Promise.resolve(
        hook(this.context, {
          stepId: this.stepDef.id,
          stepType: this.stepDef.constructor.name,
          status: this.status,
          error,
        }),
      );
    }
  }

  protected getStepHooks() {
    const step = this.stepDef as IStepDef;

    if (!("hooks" in step)) return;

    return (step as StepDefWithHooks<InferredContext<TStep>>).hooks;
  }

  protected getPreHooks() {
    return [
      ...(this.options?.flowHooks?.pre ?? []),
      ...(this.getStepHooks()?.pre ?? []),
    ];
  }

  protected getPostHooks() {
    return [
      ...(this.getStepHooks()?.post ?? []),
      ...(this.options?.flowHooks?.post ?? []),
    ];
  }

  onStopRequested(action: () => any) {
    this.onStopRequestedActions.push(action);
  }

  onFinished(action: () => any) {
    this.onFinishedActions.push(action);
  }
}
