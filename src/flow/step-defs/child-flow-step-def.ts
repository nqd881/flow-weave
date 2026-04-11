import { IFlowDef, IFlowContext } from "../../contracts";
import { ContextAdapter } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export class ChildFlowStepDef<
  TContext extends IFlowContext = IFlowContext,
  TChildContext extends IFlowContext = IFlowContext,
> extends StepDef<TContext> {
  constructor(
    public readonly childFlow: IFlowDef<TChildContext>,
    public readonly adapt?: ContextAdapter<TContext, TChildContext>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
