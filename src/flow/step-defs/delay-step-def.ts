import { IFlowContext } from "../../contracts";
import { Selector } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class DelayStepDef<
  TContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(
    public readonly durationSelector: Selector<TContext, number>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
