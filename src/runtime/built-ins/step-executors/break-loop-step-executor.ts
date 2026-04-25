import { IStepExecution, IStepExecutor } from "../../../contracts";
import { BreakLoopStepDef } from "../../../flow/step-defs";
import { BreakLoopSignal } from "../../execution-signals";

export class BreakLoopStepExecutor implements IStepExecutor<BreakLoopStepDef> {
  async execute(stepExecution: IStepExecution<BreakLoopStepDef>): Promise<any> {
    throw new BreakLoopSignal();
  }
}
