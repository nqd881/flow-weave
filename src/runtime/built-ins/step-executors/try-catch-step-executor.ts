import { IStepExecution, IStepExecutor } from "../../../contracts";
import { TryCatchStepDef } from "../../../flow/step-defs";
import { BreakLoopSignal, StopSignal } from "../../execution-signals";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class TryCatchStepExecutor implements IStepExecutor<TryCatchStepDef> {
  async execute(stepExecution: IStepExecution<TryCatchStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    const tryContext = stepDef.tryBranch.adapt
      ? await stepDef.tryBranch.adapt(context)
      : context;
    const tryExecution = stepExecution.createChildFlowExecution(
      stepDef.tryBranch.flow,
      tryContext,
    );

    throwIfStopRequested(stepExecution);

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
      const catchExecution = stepExecution.createChildFlowExecution(
        stepDef.catchBranch.flow,
        catchContext,
      );

      throwIfStopRequested(stepExecution);

      await catchExecution.start();
    }
  }
}
