import { IFlowDef, IFlowContext } from "../../contracts";
import { ContextAdapter, ParallelStepStrategy, Selector } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class ParallelForEachStepDef<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
  TItem = unknown,
> extends StepDef<TContext> {
  constructor(
    public readonly itemsSelector: Selector<TContext, TItem[]>,
    public readonly itemFlow: IFlowDef<TBranchContext>,
    public readonly adapt?: ContextAdapter<TContext, TBranchContext, [TItem]>,
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
