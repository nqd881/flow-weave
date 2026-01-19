import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { Branch } from "../types";
import { StepDef } from "./step-def";

export enum ParallelStepStrategy {
  FailFast = "fail-fast",
  CollectAll = "collect-all",
  FirstCompleted = "first-completed",
}

export class ParallelStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> extends StepDef<TContext> {
  constructor(
    public readonly branches: Branch<TContext, any>[],
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.CollectAll,
    id?: string
  ) {
    super(id);
  }
}
