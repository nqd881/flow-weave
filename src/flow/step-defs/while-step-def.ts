import { IFlowDef, IFlowContext } from "../../contracts";
import { Condition, ContextAdapter } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class WhileStepDef<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(
    public readonly condition: Condition<TContext>,
    public readonly iterationFlow: IFlowDef<TBranchContext>,
    public readonly adapt?: ContextAdapter<TContext, TBranchContext>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
