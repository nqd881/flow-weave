import {
  ExecutionStatus,
  FlowExecutionCompletedOutcome,
  FlowExecutionFailedOutcome,
  FlowExecutionOutcome,
  FlowExecutionStoppedOutcome,
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
  IFlowRuntime,
  IStepDef,
  IStepExecution,
  InferredContext,
} from "../../contracts";
import { v4 } from "uuid";
import { BreakLoopSignal, StopSignal } from "../execution-signals";
import {
  InvalidExecutionStateError,
  UncaughtBreakLoopError,
} from "../execution-errors";
import { BaseExecution } from "./base-execution";

export class FlowExecution<TFlow extends IFlowDef = IFlowDef>
  extends BaseExecution
  implements IFlowExecution<TFlow>
{
  protected status: ExecutionStatus = ExecutionStatus.Pending;
  protected outcome?: FlowExecutionOutcome;

  public readonly id = v4();

  constructor(
    protected readonly flowRuntime: IFlowRuntime<TFlow>,
    public readonly executor: IFlowExecutor<TFlow>,
    public readonly flowDef: TFlow,
    public readonly context: InferredContext<TFlow>,
    parentExecution?: BaseExecution,
  ) {
    super(parentExecution);
  }

  createStepExecution<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecution<TStep> {
    return this.flowRuntime.createStepExecution(this, stepDef);
  }

  async start() {
    if (this.status !== ExecutionStatus.Pending) {
      throw new InvalidExecutionStateError();
    }

    let primaryThrowable: unknown;

    await this.runWithParentStopBinding(async () => {
      try {
        this.status = ExecutionStatus.Running;

        if (this.isStopRequested()) {
          throw new StopSignal();
        }

        await this.executor.execute(this);
        this.outcome = new FlowExecutionCompletedOutcome();
      } catch (error) {
        primaryThrowable = error;

        if (error instanceof StopSignal) {
          this.outcome = new FlowExecutionStoppedOutcome();
        } else if (error instanceof BreakLoopSignal) {
          this.outcome = new FlowExecutionCompletedOutcome();

          if (!this.parentExecution) {
            primaryThrowable = new UncaughtBreakLoopError();
          }
        } else {
          this.outcome = new FlowExecutionFailedOutcome(error);
        }
      } finally {
        this.status = ExecutionStatus.Finished;
        await this.runAfterFinish(primaryThrowable);
      }
    });

    if (typeof primaryThrowable !== "undefined") {
      throw primaryThrowable;
    }
  }

  getStatus(): ExecutionStatus {
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
}
