import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { BranchAdapter, Condition } from "../types";
import { StepDef } from "./step-def";

export class WhileStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext
> extends StepDef<TContext> {
  constructor(
    public readonly condition: Condition<TContext>,
    public readonly body: IFlowDef<TBranchContext>,
    public readonly adapt?: BranchAdapter<TContext, TBranchContext>,
    id?: string
  ) {
    super(id);
  }
}
