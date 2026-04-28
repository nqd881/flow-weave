import type {
  IFlowDef,
  IFlowContext,
  IStepDef,
} from "../../../contracts";
import type { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { ParallelStepDef, StepDefMetadata } from "../../../flow/step-defs";
import {
  Branch,
  ContextAdapter,
  ParallelStepStrategy,
} from "../../../flow/types";
import { ParallelStepBranchRequiredError } from "../../validation-errors";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> implements IStepDefBuilder<ParallelStepDef<TContext>> {
  protected branches: Branch<TContext>[] = [];
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly weaver: TWeaver,
  ) {}

  branch(
    branchFlow: IFlowDef<TContext> | FlowDefFactory<TWeaver, TContext>,
    adapt?: ContextAdapter<TContext, TContext>,
  ): this;
  branch<TBranchContext extends IFlowContext>(
    branchFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt: ContextAdapter<TContext, TBranchContext>,
  ): this;
  branch<TBranchContext extends IFlowContext>(
    branchFlow: IFlowDef | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof branchFlow !== "function") {
      this.branches.push({ flow: branchFlow, adapt });
      return this;
    }

    const branchDef = branchFlow(this.weaver);
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

  build(metadata?: StepDefMetadata<TContext>) {
    if (!this.branches.length) throw new ParallelStepBranchRequiredError();

    return new ParallelStepDef<TContext>(
      this.branches as Branch[],
      this.strategy,
      metadata,
    );
  }
}
