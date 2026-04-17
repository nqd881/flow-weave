import { IFlowContext } from "../../contracts";
import { Branch } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class TryCatchStepDef<
  TContext extends IFlowContext = IFlowContext,
  TTryContext extends IFlowContext = IFlowContext,
  TCatchContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(
    public readonly tryBranch: Branch<TContext, TTryContext>,
    public readonly catchBranch: Branch<TContext, TCatchContext, [unknown]>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
