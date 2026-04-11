import { IFlowContext } from "../../contracts";
import { Branch, Predicate, Selector } from "../types";
import { StepDef } from "./step-def";
import { StepDefMetadata } from "./step-metadata";

export interface SwitchCase<
  TContext extends IFlowContext = IFlowContext,
  TBranchContext extends IFlowContext = IFlowContext,
  TValue = unknown
> extends Branch<TContext, TBranchContext> {
  readonly predicate: Predicate<TContext, TValue>;
}

export class SwitchStepDef<
  TContext extends IFlowContext = IFlowContext,
  TValue = unknown
> extends StepDef<TContext> {
  constructor(
    public readonly selector: Selector<TContext, TValue>,
    public readonly cases: SwitchCase<TContext, any, TValue>[],
    public readonly defaultBranch?: Branch<TContext>,
    metadata?: StepDefMetadata<TContext>,
  ) {
    super(metadata);
  }
}
