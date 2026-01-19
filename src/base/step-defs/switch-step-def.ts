import { IFlowExecutionContext } from "../../abstraction";
import { Branch, Predicate, Selector } from "../types";
import { StepDef } from "./step-def";

export interface SwitchCase<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  TValue = unknown
> extends Branch<TContext, TBranchContext> {
  readonly predicate: Predicate<TContext, TValue>;
}

export class SwitchStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
  TValue = unknown
> extends StepDef<TContext> {
  constructor(
    public readonly selector: Selector<TContext, TValue>,
    public readonly cases: SwitchCase<TContext, any, TValue>[],
    public readonly defaultBranch?: Branch<TContext>,
    id?: string
  ) {
    super(id);
  }
}
