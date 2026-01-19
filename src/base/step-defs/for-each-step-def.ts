import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { BranchAdapter, Selector } from "../types";
import { StepDef } from "./step-def";

export class ForEachStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  TItem = unknown
> extends StepDef<TContext> {
  constructor(
    public readonly itemsSelector: Selector<TContext, TItem[]>,
    public readonly body: IFlowDef<TBranchContext>,
    public readonly adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
    id?: string
  ) {
    super(id);
  }
}
