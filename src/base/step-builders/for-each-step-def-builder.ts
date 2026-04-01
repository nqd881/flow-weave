import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ForEachStepDef, StepOptions } from "../step-defs";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ForEachStepDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
  TParentBuilder extends FlowDefBuilder<TFlowBuilderClient, TContext> = FlowDefBuilder<TFlowBuilderClient, TContext>,
> implements IStepDefBuilder<ForEachStepDef<TContext, any, TItem>> {
  protected itemFlow: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly flowBuilderClient: TFlowBuilderClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
    protected readonly stepId?: string,
    protected readonly stepOptions?: StepOptions<TContext>,
  ) {}

  run(
    flow: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>,
  ): TParentBuilder;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): TParentBuilder;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): TParentBuilder {
    if (typeof flow !== "function") {
      this.itemFlow = flow;
      this.adapt = adapt;

      return this.parentBuilder;
    }

    this.itemFlow = flow(this.flowBuilderClient);
    this.adapt = adapt;

    return this.parentBuilder;
  }

  build(id?: string) {
    if (!this.itemFlow) {
      throw new Error("ForEach step requires run(...) before build.");
    }

    return new ForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      id ?? this.stepId,
      this.stepOptions,
    );
  }
}
