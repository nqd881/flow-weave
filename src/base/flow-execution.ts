import {
  FlowExecutionStatus,
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
  InferredContext,
} from "../abstraction";
import { IClient } from "../abstraction/client";

export class FlowStoppedError extends Error {
  constructor() {
    super("Flow execution was stopped.");
  }
}

export class FlowExecution<TFlow extends IFlowDef = IFlowDef>
  implements IFlowExecution<TFlow>
{
  protected status: FlowExecutionStatus = FlowExecutionStatus.Pending;
  protected stopRequested = false;

  protected finished = Promise.withResolvers<void>();
  protected error: any;

  protected onStopRequestedActions: Array<() => any> = [];
  protected onFinishedActions: Array<() => any> = [];

  constructor(
    public readonly client: IClient,
    public readonly executor: IFlowExecutor<TFlow>,
    public readonly flowDef: TFlow,
    public readonly context: InferredContext<TFlow>
  ) {
    this.init();
  }

  init() {}

  async start() {
    if (this.status !== FlowExecutionStatus.Pending) throw new Error();

    try {
      this.status = FlowExecutionStatus.Running;

      await this.executor.execute(this);

      this.status = FlowExecutionStatus.Completed;
    } catch (error) {
      if (error instanceof FlowStoppedError) {
        this.status = FlowExecutionStatus.Stopped;
      } else {
        this.error = error;
        this.status = FlowExecutionStatus.Failed;

        throw error;
      }
    } finally {
      await this.runActions(this.onFinishedActions);

      this.finished.resolve();
    }
  }

  requestStop(): void {
    if (!this.stopRequested) {
      this.stopRequested = true;

      this.runActions(this.onStopRequestedActions);
    }
  }

  protected async runActions(actions: Array<() => any>) {
    for (const action of actions) {
      await Promise.resolve(action());
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

  async waitUntilFinished(): Promise<any> {
    return this.finished.promise;
  }
}
