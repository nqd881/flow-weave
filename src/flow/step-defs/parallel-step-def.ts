import { IFlowContext } from "../../contracts";
import { Branch, ParallelStepStrategy } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class ParallelStepDef<
  TContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(
    public readonly branches: Branch<TContext, any>[],
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
