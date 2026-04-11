import { IFlowDef, IFlowContext } from "../../contracts";
import { ContextAdapter, Selector } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class ForEachStepDef<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
  TItem = unknown,
> extends StepDef<TContext> {
  constructor(
    public readonly itemsSelector: Selector<TContext, TItem[]>,
    public readonly itemFlow: IFlowDef<TBranchContext>,
    public readonly adapt?: ContextAdapter<TContext, TBranchContext, [TItem]>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
