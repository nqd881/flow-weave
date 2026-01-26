import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ParallelForEachStepDef } from "../step-defs";
import { ParallelStepStrategy } from "../types";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelForEachStepDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
> implements IStepDefBuilder<ParallelForEachStepDef<TContext, any, TItem>> {
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;
  protected itemFlow: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<
      TFlowBuilderClient,
      TContext
    >,
    protected readonly flowBuilderClient: TFlowBuilderClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
    protected readonly stepId?: string,
  ) {}

  run(
    flow: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this {
    if (typeof flow !== "function") {
      this.itemFlow = flow;
      this.adapt = adapt;

      return this;
    }

    this.itemFlow = flow(this.flowBuilderClient);
    this.adapt = adapt;

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

  join() {
    return this.parentBuilder;
  }

  build(id?: string) {
    return new ParallelForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      this.strategy,
      id ?? this.stepId,
    );
  }
}
