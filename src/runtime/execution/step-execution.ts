import {
  ExecutionStatus,
  IFlowContext,
  IFlowDef,
  IFlowExecution,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepExecutionCompletedOutcome,
  StepExecutionFailedOutcome,
  StepExecutionFailureInfo,
  StepExecutionFailureSource,
  StepExecutionInfo,
  StepExecutionOutcome,
  StepExecutionRecoveredOutcome,
  StepExecutionStoppedOutcome,
} from "../../contracts";
import {
  StepDefMetadata,
  StepDefWithHooks,
  StepHook,
  StepHooks,
  StepRetryBackoff,
  StepRetryPolicy,
} from "../../flow/step-defs";
import { BreakLoopSignal, StopSignal } from "../execution-signals";
import {
  InvalidExecutionStateError,
  InvalidRetryBackoffError,
  InvalidRetryInitialDelayError,
  InvalidRetryMaxAttemptsError,
  InvalidRetryMaxDelayError,
  StepOutcomeResolutionError,
} from "../execution-errors";
import { BaseExecution } from "./base-execution";
import { CreateFlowExecution } from "./create-child-flow-execution";

type StepExecutionOptions<TContext extends IFlowContext = IFlowContext> = {
  flowHooks?: StepHooks<TContext>;
};

type NormalizedStepRetryPolicy<TContext extends IFlowContext = IFlowContext> =
  StepRetryPolicy<TContext> & {
    initialDelayMs: number;
    backoff: StepRetryBackoff;
  };

export class StepExecution<TStep extends IStepDef>
  extends BaseExecution
  implements IStepExecution<TStep>
{
  protected status: ExecutionStatus = ExecutionStatus.Pending;
  protected outcome?: StepExecutionOutcome;
  protected error?: unknown;

  constructor(
    protected readonly createFlowExecution: CreateFlowExecution,
    public readonly executor: IStepExecutor<TStep>,
    public readonly stepDef: TStep,
    public readonly context: InferredContext<TStep>,
    protected readonly options?: StepExecutionOptions<InferredContext<TStep>>,
    parentExecution?: BaseExecution,
  ) {
    super(parentExecution);
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }

  getOutcome() {
    return this.outcome;
  }

  getError() {
    return this.error;
  }

  createChildFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow> {
    return this.createFlowExecution(flowDef, context, this);
  }

  async start() {
    if (this.status !== ExecutionStatus.Pending) {
      throw new InvalidExecutionStateError();
    }

    let primaryThrowable: unknown;

    await this.runWithParentStopBinding(async () => {
      this.beginExecution();

      try {
        this.throwIfStopRequested();

        const preHookError = await this.tryRunStepHooks(this.getPreHooks());

        if (preHookError) {
          this.outcome = this.createPreHookFailureOutcome(preHookError);
          primaryThrowable = preHookError;
        } else {
          this.outcome = await this.resolveCoreExecution();
        }
      } catch (error) {
        if (error instanceof StopSignal) {
          this.outcome = new StepExecutionStoppedOutcome();
          primaryThrowable = error;
        } else if (error instanceof BreakLoopSignal) {
          this.outcome = new StepExecutionCompletedOutcome();
          primaryThrowable = error;
        } else {
          this.outcome = await this.resolveExecutionFailure(error);

          if (this.outcome instanceof StepExecutionFailedOutcome) {
            primaryThrowable = this.outcome.error;
          }
        }
      } finally {
        const outcome = this.getRequiredOutcome();
        const postHookError = await this.tryRunStepHooks(this.getPostHooks(), {
          outcome,
        });

        primaryThrowable = this.resolvePrimaryThrowable(
          primaryThrowable,
          postHookError,
        );
        this.commitExecutionResult(primaryThrowable);

        this.finishExecution();
        await this.runAfterFinish(primaryThrowable);
      }
    });

    this.rethrowIfNeeded(primaryThrowable);
  }

  protected beginExecution() {
    this.outcome = undefined;
    this.error = undefined;
    this.status = ExecutionStatus.Running;
  }

  protected createPreHookFailureOutcome(error: unknown) {
    return new StepExecutionFailedOutcome(
      error,
      StepExecutionFailureSource.PreHook,
    );
  }

  protected async tryRunStepHooks(
    hooks: StepHook<InferredContext<TStep>>[] = [],
    infoOverrides: Partial<StepExecutionInfo> = {},
  ) {
    try {
      await this.runStepHooks(hooks, infoOverrides);
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

  protected commitExecutionResult(throwable?: unknown) {
    this.error = this.resolveTerminalError(throwable);
  }

  protected getRequiredOutcome(): StepExecutionOutcome {
    if (!this.outcome) {
      throw new StepOutcomeResolutionError();
    }

    return this.outcome;
  }

  protected finishExecution() {
    this.status = ExecutionStatus.Finished;
  }

  protected resolvePrimaryThrowable(
    primaryThrowable?: unknown,
    postHookError?: unknown,
  ) {
    if (!primaryThrowable && postHookError) {
      return postHookError;
    }

    return primaryThrowable;
  }

  protected resolveTerminalError(primaryThrowable?: unknown) {
    if (
      typeof primaryThrowable === "undefined" ||
      primaryThrowable instanceof StopSignal ||
      primaryThrowable instanceof BreakLoopSignal
    ) {
      return undefined;
    }

    return primaryThrowable;
  }

  protected rethrowIfNeeded(primaryThrowable?: unknown) {
    if (primaryThrowable) {
      throw primaryThrowable;
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
      throw new InvalidRetryMaxAttemptsError();
    }

    const initialDelayMs = policy.initialDelayMs ?? 0;

    if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
      throw new InvalidRetryInitialDelayError();
    }

    if (
      typeof policy.maxDelayMs !== "undefined" &&
      (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < 0)
    ) {
      throw new InvalidRetryMaxDelayError();
    }

    const backoff: StepRetryBackoff = policy.backoff ?? "constant";

    if (backoff !== "constant" && backoff !== "exponential") {
      throw new InvalidRetryBackoffError();
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
}
