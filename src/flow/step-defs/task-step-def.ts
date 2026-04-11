import { IFlowContext } from "../../contracts";
import { AnyTask, Task } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class TaskStepDef<
  TContext extends IFlowContext = IFlowContext,
  TTask extends Task<TContext> = AnyTask,
> extends StepDef<TContext> {
  constructor(
    public readonly task: TTask,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
