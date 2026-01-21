import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ParallelForEachStepDef, ParallelStepStrategy } from "../step-defs";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelForEachStepDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
> implements IStepDefBuilder<ParallelForEachStepDef<TContext, any, TItem>> {
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.CollectAll;
  protected body: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TBuilderClient, TContext>,
    protected readonly builderClient: TBuilderClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
  ) {}

  run(
    body: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    body:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    body:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this {
    if (typeof body !== "function") {
      this.body = body;
      this.adapt = adapt;

      return this;
    }

    this.body = body(this.builderClient);
    this.adapt = adapt;

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

  build(id?: string) {
    return new ParallelForEachStepDef(
      this.itemsSelector,
      this.body,
      this.adapt,
      this.strategy,
      id,
    );
  }
}
