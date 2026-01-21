import type { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import type { FlowDefBuilder } from "../flow-def-builder";
import { ParallelStepDef } from "../step-defs/parallel-step-def";
import {
  Branch,
  BranchAdapter,
  FlowFactory,
  ParallelStepStrategy,
} from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelStepDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext,
> implements IStepDefBuilder<ParallelStepDef<TContext>> {
  protected branches: Branch<TContext>[] = [];
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TBuilderClient, TContext>,
    protected readonly builderClient: TBuilderClient,
  ) {}

  branch(
    branchFlow: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    branchFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    branchFlow: IFlowDef | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof branchFlow !== "function") {
      this.branches.push({ flow: branchFlow, adapt });
      return this;
    }

    const branchDef = branchFlow(this.builderClient);
    this.branches.push({ flow: branchDef, adapt });

    return this;
  }

  allSettled() {
    this.strategy = ParallelStepStrategy.AllSettled;
    return this;
  }

  failFast() {
    this.strategy = ParallelStepStrategy.FailFast;
    return this;
  }

  firstSuccess() {
    this.strategy = ParallelStepStrategy.FirstSuccess;
    return this;
  }

  join() {
    return this.parentBuilder;
  }

  build() {
    if (!this.branches.length)
      throw new Error("Parallel step must have at least one branch.");

    return new ParallelStepDef<TContext>(
      this.branches as Branch[],
      this.strategy,
    );
  }
}
