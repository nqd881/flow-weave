import type { IFlowContext, IStepDef } from "../../contracts";
import type { StepDefMetadata } from "../../flow/step-defs";

export interface IStepDefBuilder<TStep extends IStepDef = IStepDef> {
  build(metadata?: StepDefMetadata<IFlowContext>): TStep;
}
