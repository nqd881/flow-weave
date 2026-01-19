import { TaskStepDef } from "../step-defs";
import { IStepDefBuilder } from "./step-def-builder";
import type { FlowDefBuilder } from "../flow-def-builder";

export class TaskStepDefBuilder implements IStepDefBuilder<TaskStepDef> {
  constructor(protected readonly parentBuilder: FlowDefBuilder<any>) {}

  build(): TaskStepDef {
    throw new Error("Method not implemented.");
  }
}
