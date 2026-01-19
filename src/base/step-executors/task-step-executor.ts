import { IStepExecution, IStepExecutor } from "../../abstraction";
import { TaskStepDef } from "../step-defs";

export class TaskStepExecutor implements IStepExecutor<TaskStepDef> {
  async execute(execution: IStepExecution<TaskStepDef>) {
    const { stepDef, context } = execution;

    await stepDef.task(context);
  }
}
