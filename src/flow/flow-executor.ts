import {
  IFlowDef,
  IFlowExecution,
  IFlowContext,
  IFlowExecutor,
  IFlowRuntime,
  IStepDef,
  IStepExecution,
  IStepExecutor,
} from "../contracts";
import { FlowDefWithHooks } from "./flow-metadata";
import { BreakLoopSignal, StopSignal } from "./control-signals";
import { StepExecution } from "./step-execution";

export class FlowExecutor<
  TFlow extends IFlowDef,
> implements IFlowExecutor<TFlow> {
  createStepExecution(
    runtime: IFlowRuntime,
    flowDef: IFlowDef,
    stepDef: IStepDef,
    context: IFlowContext,
  ): IStepExecution {
    const flowHooks = this.getFlowHooks(flowDef);

    return new StepExecution(
      runtime,
      this.resolveStepExecutor(runtime, stepDef),
      stepDef,
      context,
      {
        flowHooks,
      },
    );
  }

  async execute(flowExecution: IFlowExecution<TFlow>): Promise<any> {
    const { runtime, flowDef, context } = flowExecution;

    let currentStepExecution: IStepExecution | undefined;

    flowExecution.onStopRequested(() => {
      currentStepExecution?.requestStop();
    });

    for (const stepDef of flowDef.steps) {
      if (flowExecution.isStopRequested()) throw new StopSignal();

      const stepExecution = this.createStepExecution(
        runtime,
        flowDef,
        stepDef,
        context,
      );

      try {
        this.beforeStepStart(flowExecution, stepExecution);

        currentStepExecution = stepExecution;

        await stepExecution.start();
      } catch (error) {
        if (error instanceof StopSignal) throw error;
        if (error instanceof BreakLoopSignal) throw error;

        throw error;
      } finally {
        this.afterStepFinished(flowExecution, stepExecution);
      }
    }
  }

  resolveStepExecutor<TStep extends IStepDef>(
    runtime: IFlowRuntime,
    stepDef: TStep,
  ): IStepExecutor<TStep> {
    const executor = runtime.resolveStepExecutor(stepDef);

    if (!executor) {
      throw new Error(
        `No executor registered for step type '${stepDef.constructor.name}'.`,
      );
    }

    return executor;
  }

  beforeStepStart(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution,
  ) {}

  afterStepFinished(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution,
  ) {}

  protected getFlowHooks(flowDef: IFlowDef) {
    if (!("hooks" in flowDef)) return;

    return (flowDef as FlowDefWithHooks).hooks;
  }
}
