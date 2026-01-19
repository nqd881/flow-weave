import type { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import type { IFlowBuilderClient, FlowDefBuilder } from "../flow-def-builder";
import {
  ParallelStepDef,
  ParallelStepStrategy,
} from "../step-defs/parallel-step-def";
import { Branch, BranchAdapter, FlowFactory } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelStepDefBuilder<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext
> implements IStepDefBuilder<ParallelStepDef<TContext>>
{
  protected branches: Branch<TContext>[] = [];
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.CollectAll;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TClient, TContext>,
    protected readonly client: TClient
  ) {}

  branch(
    def: IFlowDef<TContext> | FlowFactory<TClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext>
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    factory: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext>
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    branch: IFlowDef | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>
  ): this {
    if (typeof branch !== "function") {
      this.branches.push({ flow: branch, adapt });
      return this;
    }

    const branchDef = branch(this.client);
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
      this.strategy
    );
  }
}
