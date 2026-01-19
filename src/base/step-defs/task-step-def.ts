import { IFlowExecutionContext } from "../../abstraction";
import { AnyTask, Task } from "../types";
import { StepDef } from "./step-def";

export class TaskStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TTask extends Task<TContext> = AnyTask
> extends StepDef<TContext> {
  constructor(public readonly task: TTask) {
    super();
  }
}
