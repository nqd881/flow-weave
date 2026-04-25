import { IStepExecution, IStepExecutor } from "../../../contracts";
import { DelayStepDef } from "../../../flow/step-defs";
import { InvalidDelayDurationError } from "../../execution-errors";
import { StopSignal } from "../../execution-signals";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class DelayStepExecutor implements IStepExecutor<DelayStepDef> {
  async execute(stepExecution: IStepExecution<DelayStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    const durationMs = await stepDef.durationSelector(context);

    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new InvalidDelayDurationError();
    }

    throwIfStopRequested(stepExecution);

    if (durationMs === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        settled = true;
        resolve();
      }, durationMs);

      stepExecution.onStopRequested(() => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        reject(new StopSignal());
      });
    });
  }
}
