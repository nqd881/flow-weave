import { IStepExecution, IStepExecutor } from "../../contracts";
import { BreakLoopSignal } from "../control-signals";
import { BreakLoopStepDef } from "../step-defs";

export class BreakLoopStepExecutor implements IStepExecutor<BreakLoopStepDef> {
  async execute(stepExecution: IStepExecution<BreakLoopStepDef>): Promise<any> {
    throw new BreakLoopSignal();
  }
}
