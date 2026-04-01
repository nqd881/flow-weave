import type {
  IFlowDef,
  IFlowExecutionContext,
} from "../../abstraction";
import type { FlowDefBuilder } from "../flow-def-builder";
import { ParallelStepDef, StepOptions } from "../step-defs";
import {
  Branch,
  BranchAdapter,
  FlowFactory,
  ParallelStepStrategy,
} from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelStepDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TParentBuilder extends FlowDefBuilder<TFlowBuilderClient, TContext> = FlowDefBuilder<TFlowBuilderClient, TContext>,
> implements IStepDefBuilder<ParallelStepDef<TContext>> {
  protected branches: Branch<TContext>[] = [];
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly flowBuilderClient: TFlowBuilderClient,
    protected readonly stepId?: string,
    protected readonly stepOptions?: StepOptions<TContext>,
  ) {}

  branch(
    branchFlow: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    branchFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext>,
  ): this;
  branch<TBranchContext extends IFlowExecutionContext>(
    branchFlow: IFlowDef | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof branchFlow !== "function") {
      this.branches.push({ flow: branchFlow, adapt });
      return this;
    }

    const branchDef = branchFlow(this.flowBuilderClient);
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

  firstSettled() {
    this.strategy = ParallelStepStrategy.FirstSettled;
    return this;
  }

  firstCompleted() {
    this.strategy = ParallelStepStrategy.FirstCompleted;
    return this;
  }

  join(): TParentBuilder {
    return this.parentBuilder;
  }

  build(id?: string) {
    if (!this.branches.length)
      throw new Error("Parallel step must have at least one branch.");

    return new ParallelStepDef<TContext>(
      this.branches as Branch[],
      this.strategy,
      id ?? this.stepId,
      this.stepOptions,
    );
  }
}
