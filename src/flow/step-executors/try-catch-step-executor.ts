import { IStepExecution, IStepExecutor } from "../../contracts";
import { BreakLoopSignal, StopSignal } from "../control-signals";
import { TryCatchStepDef } from "../step-defs";

export class TryCatchStepExecutor implements IStepExecutor<TryCatchStepDef> {
  async execute(stepExecution: IStepExecution<TryCatchStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const tryContext = stepDef.tryBranch.adapt
      ? await stepDef.tryBranch.adapt(context)
      : context;
    const tryExecution = runtime.createFlowExecution(
      stepDef.tryBranch.flow,
      tryContext,
    );

    stepExecution.onStopRequested(() => tryExecution.requestStop());

    stepExecution.throwIfStopRequested();

    try {
      await tryExecution.start();
      return;
    } catch (tryError) {
      if (
        tryError instanceof StopSignal ||
        tryError instanceof BreakLoopSignal
      ) {
        throw tryError;
      }

      const catchContext = stepDef.catchBranch.adapt
        ? await stepDef.catchBranch.adapt(context, tryError)
        : context;
      const catchExecution = runtime.createFlowExecution(
        stepDef.catchBranch.flow,
        catchContext,
      );

      stepExecution.onStopRequested(() => catchExecution.requestStop());

      stepExecution.throwIfStopRequested();

      await catchExecution.start();
    }
  }
}
