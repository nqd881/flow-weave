import { IFlowExecutionContext } from "../../abstraction";
import { Branch, ParallelStepStrategy } from "../types";
import { StepDef, StepOptions } from "./step-def";

export class ParallelStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends StepDef<TContext> {
  constructor(
    public readonly branches: Branch<TContext, any>[],
    public readonly strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled,
    id?: string,
    options?: StepOptions<TContext>,
  ) {
    super({ id, hooks: options?.hooks });
  }
}
