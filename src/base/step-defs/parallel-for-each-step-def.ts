import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { BranchAdapter, ParallelStepStrategy, Selector } from "../types";
import { StepDef } from "./step-def";

export class ParallelForEachStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  TItem = unknown,
> extends StepDef<TContext> {
  constructor(
    public readonly itemsSelector: Selector<TContext, TItem[]>,
    public readonly itemFlow: IFlowDef<TBranchContext>,
    public readonly adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled,
    id?: string,
  ) {
    super(id);
  }
}
