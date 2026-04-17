import {
  IFlowContext,
  IFlowRuntime,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepExecutionCompletedOutcome,
  StepExecutionFailureInfo,
  StepExecutionFailureSource,
  StepExecutionFailedOutcome,
  StepExecutionInfo,
  StepExecutionOutcome,
  StepExecutionOutcomeKind,
  StepExecutionRecoveredOutcome,
  StepExecutionStatus,
  StepExecutionStoppedOutcome,
} from "../contracts";
import {
  StepDefMetadata,
  StepDefWithHooks,
  StepHook,
  StepHooks,
  StepRetryBackoff,
  StepRetryPolicy,
} from "./step-defs";
import { BreakLoopSignal, StopSignal } from "./control-signals";

type StepExecutionOptions<TContext extends IFlowContext = IFlowContext> = {
  flowHooks?: StepHooks<TContext>;
};

type NormalizedStepRetryPolicy<TContext extends IFlowContext = IFlowContext> =
  StepRetryPolicy<TContext> & {
    initialDelayMs: number;
    backoff: StepRetryBackoff;
  };

export class StepExecution<
  TStep extends IStepDef,
> implements IStepExecution<TStep> {
  protected status: StepExecutionStatus = StepExecutionStatus.Pending;
  protected stopRequested = false;
  protected outcome?: StepExecutionOutcome;
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

  getOutcome() {
    return this.outcome;
  }

  getError() {
    return this.error;
  }

  isStopRequested() {
    return this.stopRequested;
  }

  throwIfStopRequested() {
    if (this.stopRequested) {
      throw new StopSignal();
    }
  }

  isPending() {
    return this.status === StepExecutionStatus.Pending;
  }

  isRunning() {
    return this.status === StepExecutionStatus.Running;
  }

  isFinished() {
    return this.status === StepExecutionStatus.Finished;
  }

  isCompleted() {
    return this.outcome?.kind === StepExecutionOutcomeKind.Completed;
  }

  isRecovered() {
    return this.outcome?.kind === StepExecutionOutcomeKind.Recovered;
  }

  isFailed() {
    return this.outcome?.kind === StepExecutionOutcomeKind.Failed;
  }

  isStopped() {
    return this.outcome?.kind === StepExecutionOutcomeKind.Stopped;
  }

  async start() {
    if (this.status !== StepExecutionStatus.Pending) throw new Error();

    let outcome: StepExecutionOutcome | undefined;
    let throwable: unknown;

    this.beginExecution();

    try {
      const preHookError = await this.runPreHooks();

      if (preHookError) {
        outcome = this.createPreHookFailureOutcome(preHookError);
        throwable = preHookError;
      } else {
        outcome = await this.resolveCoreExecution();
      }
    } catch (error) {
      if (error instanceof StopSignal) {
        outcome = new StepExecutionStoppedOutcome();
        throwable = error;
      } else if (error instanceof BreakLoopSignal) {
        outcome = new StepExecutionCompletedOutcome();
        throwable = error;
      } else {
        outcome = await this.resolveExecutionFailure(error);

        if (outcome instanceof StepExecutionFailedOutcome) {
          throwable = outcome.error;
        }
      }
    } finally {
      if (outcome) {
        const postHookError = await this.runPostHooks(outcome);
        throwable = this.resolveThrowable(throwable, postHookError);
        this.completeExecution(outcome, throwable);
      } else {
        this.finishExecution();
      }

      await this.runFinalizerSafely(throwable);
      await this.runObserverActionsSafely(this.onFinishedActions);
    }

    this.rethrowIfNeeded(throwable);
  }

  protected beginExecution() {
    this.outcome = undefined;
    this.error = undefined;
    this.status = StepExecutionStatus.Running;
  }

  protected createPreHookFailureOutcome(error: unknown) {
    return new StepExecutionFailedOutcome(
      error,
      StepExecutionFailureSource.PreHook,
    );
  }

  protected async runPreHooks() {
    try {
      await this.runStepHooks(this.getPreHooks());
    } catch (error) {
      return error;
    }
  }

  protected async resolveCoreExecution(): Promise<StepExecutionCompletedOutcome> {
    await this.executeWithRetry();

    return new StepExecutionCompletedOutcome();
  }

  protected async resolveExecutionFailure(
    error: unknown,
  ): Promise<StepExecutionFailedOutcome | StepExecutionRecoveredOutcome> {
    const recoverResult = await this.tryRecoverFailure(error);

    if (recoverResult.recovered) {
      return new StepExecutionRecoveredOutcome(
        error,
        recoverResult.failureSource,
      );
    }

    return new StepExecutionFailedOutcome(
      recoverResult.error,
      recoverResult.failureSource,
    );
  }

  protected completeExecution(
    outcome: StepExecutionOutcome,
    throwable?: unknown,
  ) {
    this.outcome = outcome;
    this.error = this.resolveTerminalError(throwable);
    this.status = StepExecutionStatus.Finished;
  }

  protected finishExecution() {
    this.status = StepExecutionStatus.Finished;
  }

  requestStop() {
    if (!this.stopRequested) {
      this.stopRequested = true;

      this.runStopActionsSafely(this.onStopRequestedActions);
    }
  }

  protected async finalizeAfterFinish(_primaryThrowable?: unknown): Promise<void> {}

  protected async runFinalizerSafely(primaryThrowable?: unknown) {
    try {
      await this.finalizeAfterFinish(primaryThrowable);
    } catch {}
  }

  protected async runObserverActionsSafely(actions: Array<() => any>) {
    for (const action of actions) {
      try {
        await Promise.resolve(action());
      } catch {}
    }
  }

  protected runStopActionsSafely(actions: Array<() => any>) {
    for (const action of actions) {
      try {
        void Promise.resolve(action()).catch(() => undefined);
      } catch {}
    }
  }

  protected async runPostHooks(outcome: StepExecutionOutcome) {
    try {
      await this.runStepHooks(this.getPostHooks(), { outcome });
    } catch (postError) {
      return postError;
    }
  }

  protected resolveThrowable(throwable?: unknown, postHookError?: unknown) {
    if (!throwable && postHookError) {
      return postHookError;
    }

    return throwable;
  }

  protected resolveTerminalError(throwable?: unknown) {
    if (
      typeof throwable === "undefined" ||
      throwable instanceof StopSignal ||
      throwable instanceof BreakLoopSignal
    ) {
      return undefined;
    }

    return throwable;
  }

  protected rethrowIfNeeded(throwable?: unknown) {
    if (throwable) {
      throw throwable;
    }
  }

  protected createStepExecutionInfo(
    overrides: Partial<StepExecutionInfo> = {},
  ): StepExecutionInfo {
    const info: StepExecutionInfo = {
      stepId: this.stepDef.id,
      stepType: this.stepDef.constructor.name,
      status: this.status,
      outcome: this.outcome,
    };

    return {
      ...info,
      ...overrides,
    };
  }

  protected createStepExecutionFailureInfo(
    overrides: Partial<StepExecutionFailureInfo> = {},
  ): StepExecutionFailureInfo {
    const info: StepExecutionFailureInfo = {
      stepId: this.stepDef.id,
      stepType: this.stepDef.constructor.name,
      failureSource: StepExecutionFailureSource.Execute,
    };

    return {
      ...info,
      ...overrides,
    };
  }

  protected async runStepHooks(
    hooks: StepHook<InferredContext<TStep>>[] = [],
    infoOverrides: Partial<StepExecutionInfo> = {},
  ) {
    if (!hooks?.length) return;

    for (const hook of hooks) {
      await Promise.resolve(
        hook(this.context, this.createStepExecutionInfo(infoOverrides)),
      );
    }
  }

  protected async executeWithRetry() {
    const retryPolicy = this.normalizeRetryPolicy(this.getStepRetryPolicy());
    let attempt = 1;

    while (true) {
      this.throwIfStopRequested();

      try {
        await this.executor.execute(this);
        return;
      } catch (error) {
        if (error instanceof StopSignal) {
          throw error;
        }

        if (error instanceof BreakLoopSignal) {
          throw error;
        }

        if (await this.shouldRetry(error, attempt, retryPolicy)) {
          await this.waitForRetryDelay(
            this.getRetryDelayMs(retryPolicy!, attempt),
          );
          attempt += 1;
          continue;
        }

        throw error;
      }
    }
  }

  protected getStepRetryPolicy() {
    const step = this.stepDef as IStepDef;

    if (!("retry" in step)) return;

    return (step as StepDefMetadata<InferredContext<TStep>>).retry;
  }

  protected getStepRecover() {
    const step = this.stepDef as IStepDef;

    if (!("recover" in step)) return;

    return (step as StepDefMetadata<InferredContext<TStep>>).recover;
  }

  protected normalizeRetryPolicy(
    policy?: StepRetryPolicy<InferredContext<TStep>>,
  ): NormalizedStepRetryPolicy<InferredContext<TStep>> | undefined {
    if (!policy) return;

    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
      throw new Error("Step retry maxAttempts must be a positive integer.");
    }

    const initialDelayMs = policy.initialDelayMs ?? 0;

    if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
      throw new Error(
        "Step retry initialDelayMs must be a non-negative finite number.",
      );
    }

    if (
      typeof policy.maxDelayMs !== "undefined" &&
      (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < 0)
    ) {
      throw new Error(
        "Step retry maxDelayMs must be a non-negative finite number.",
      );
    }

    const backoff: StepRetryBackoff = policy.backoff ?? "constant";

    if (backoff !== "constant" && backoff !== "exponential") {
      throw new Error(
        "Step retry backoff must be 'constant' or 'exponential'.",
      );
    }

    return {
      ...policy,
      initialDelayMs,
      backoff,
    };
  }

  protected async shouldRetry(
    error: unknown,
    attempt: number,
    retryPolicy?: StepRetryPolicy<InferredContext<TStep>>,
  ) {
    if (!retryPolicy) return false;

    if (attempt >= retryPolicy.maxAttempts) return false;

    if (!retryPolicy.shouldRetry) return true;

    return !!(await Promise.resolve(
      retryPolicy.shouldRetry(error, attempt, this.context),
    ));
  }

  protected getRetryDelayMs(
    retryPolicy: NormalizedStepRetryPolicy<InferredContext<TStep>>,
    attempt: number,
  ) {
    const baseDelay = retryPolicy.initialDelayMs;
    const delayMs =
      retryPolicy.backoff === "exponential"
        ? baseDelay * 2 ** (attempt - 1)
        : baseDelay;

    if (typeof retryPolicy.maxDelayMs === "undefined") {
      return delayMs;
    }

    return Math.min(delayMs, retryPolicy.maxDelayMs);
  }

  protected async waitForRetryDelay(delayMs: number) {
    this.throwIfStopRequested();

    if (delayMs === 0) return;

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        settled = true;
        resolve();
      }, delayMs);

      this.onStopRequested(() => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        reject(new StopSignal());
      });
    });
  }

  protected async tryRecoverFailure(error: unknown) {
    const recover = this.getStepRecover();

    if (!recover) {
      return {
        recovered: false as const,
        error,
        failureSource: StepExecutionFailureSource.Execute,
      };
    }

    try {
      await Promise.resolve(
        recover(
          error,
          this.context,
          this.createStepExecutionFailureInfo({
            failureSource: StepExecutionFailureSource.Execute,
          }),
        ),
      );

      return {
        recovered: true as const,
        failureSource: StepExecutionFailureSource.Execute,
      };
    } catch (recoverError) {
      return {
        recovered: false as const,
        error: recoverError,
        failureSource: StepExecutionFailureSource.Recover,
      };
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
