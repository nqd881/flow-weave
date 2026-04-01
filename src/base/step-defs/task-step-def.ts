import { IFlowExecutionContext } from "../../abstraction";
import { AnyTask, Task } from "../types";
import { StepDef, StepOptions } from "./step-def";

export class TaskStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TTask extends Task<TContext> = AnyTask,
> extends StepDef<TContext> {
  constructor(
    public readonly task: TTask,
    id?: string,
    options?: StepOptions<TContext>,
  ) {
    super({ id, hooks: options?.hooks });
  }
}
