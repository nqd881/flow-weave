import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ForEachStepDef } from "../step-defs";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ForEachStepDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
> implements IStepDefBuilder<ForEachStepDef<TContext, any, TItem>> {
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

  end() {
    return this.parentBuilder;
  }

  build(id?: string) {
    return new ForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      id ?? this.stepId,
    );
  }
}
