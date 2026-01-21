import type { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import type { FlowDefBuilder } from "../flow-def-builder";
import {
  ParallelStepDef,
  ParallelStepStrategy,
} from "../step-defs/parallel-step-def";
import { Branch, BranchAdapter, FlowFactory } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelStepDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext,
> implements IStepDefBuilder<ParallelStepDef<TContext>> {
  protected branches: Branch<TContext>[] = [];
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.CollectAll;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TBuilderClient, TContext>,
    protected readonly builderClient: TBuilderClient,
  ) {}

  branch(
    body: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    body:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    body: IFlowDef | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof body !== "function") {
      this.branches.push({ flow: body, adapt });
      return this;
    }

    const branchDef = body(this.builderClient);
    this.branches.push({ flow: branchDef, adapt });

    return this;
  }

  all() {
    this.strategy = ParallelStepStrategy.CollectAll;
    return this;
  }

  allOrFail() {
    this.strategy = ParallelStepStrategy.FailFast;
    return this;
  }

  first() {
    this.strategy = ParallelStepStrategy.FirstCompleted;
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
