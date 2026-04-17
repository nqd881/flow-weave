import {
  FlowExecutionCompletedOutcome,
  FlowExecutionFailedOutcome,
  FlowExecutionOutcome,
  FlowExecutionStatus,
  FlowExecutionStoppedOutcome,
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
  IFlowRuntime,
  InferredContext,
} from "../contracts";
import { v4 } from "uuid";
import { BreakLoopSignal, StopSignal } from "./control-signals";

export class FlowExecution<
  TFlow extends IFlowDef = IFlowDef,
> implements IFlowExecution<TFlow> {
  protected status: FlowExecutionStatus = FlowExecutionStatus.Pending;
  protected stopRequested = false;
  protected outcome?: FlowExecutionOutcome;

  protected onStopRequestedActions: Array<() => any> = [];
  protected onFinishedActions: Array<() => any> = [];

  public readonly id = v4();

  constructor(
    public readonly runtime: IFlowRuntime,
    public readonly executor: IFlowExecutor<TFlow>,
    public readonly flowDef: TFlow,
    public readonly context: InferredContext<TFlow>,
  ) {
    this.init();
  }

  init() {}

  async start() {
    if (this.status !== FlowExecutionStatus.Pending) throw new Error();

    let primaryThrowable: unknown;

    try {
      this.status = FlowExecutionStatus.Running;

      await this.executor.execute(this);
      this.outcome = new FlowExecutionCompletedOutcome();
    } catch (error) {
      primaryThrowable = error;

      if (error instanceof StopSignal) {
        this.outcome = new FlowExecutionStoppedOutcome();
      } else if (error instanceof BreakLoopSignal) {
        this.outcome = new FlowExecutionCompletedOutcome();
      } else {
        this.outcome = new FlowExecutionFailedOutcome(error);
      }
    } finally {
      this.status = FlowExecutionStatus.Finished;
      await this.runFinalizerSafely(primaryThrowable);
      await this.runObserverActionsSafely(this.onFinishedActions);
    }

    if (typeof primaryThrowable !== "undefined") {
      throw primaryThrowable;
    }
  }

  requestStop(): void {
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

  onStopRequested(action: () => any) {
    this.onStopRequestedActions.push(action);
  }

  onFinished(action: () => any) {
    this.onFinishedActions.push(action);
  }

  getStatus(): FlowExecutionStatus {
    return this.status;
  }

  getOutcome(): FlowExecutionOutcome | undefined {
    return this.outcome;
  }

  getError() {
    if (!(this.outcome instanceof FlowExecutionFailedOutcome)) {
      return undefined;
    }

    return this.outcome.error;
  }

  isStopRequested(): boolean {
    return this.stopRequested;
  }
}
