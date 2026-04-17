import { IFlowContext } from "../../contracts";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class BreakLoopStepDef<
  TContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(metadata?: StepDefMetadata<TContext>) {
    super(metadata);
  }
}
