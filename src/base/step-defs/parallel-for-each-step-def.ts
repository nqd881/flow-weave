import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { BranchAdapter, Selector } from "../types";
import { ParallelStepStrategy } from "./parallel-step-def";
import { StepDef } from "./step-def";

export class ParallelForEachStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  TItem = unknown
> extends StepDef<TContext> {
  constructor(
    public readonly itemsSelector: Selector<TContext, TItem[]>,
    public readonly body: IFlowDef<TBranchContext>,
    public readonly adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.CollectAll,

    id?: string
  ) {
    super(id);
  }
}
