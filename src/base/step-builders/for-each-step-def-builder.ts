import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder, IFlowBuilderClient } from "../flow-def-builder";
import { ForEachStepDef } from "../step-defs";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ForEachStepDefBuilder<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown
> implements IStepDefBuilder<ForEachStepDef<TContext, any, TItem>>
{
  protected body: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TClient, TContext>,
    protected readonly client: TClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>
  ) {}

  run(
    body: IFlowDef<TContext> | FlowFactory<TClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    body: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    body: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>
  ): this {
    if (typeof body !== "function") {
      this.body = body;
      this.adapt = adapt;

      return this;
    }

    this.body = body(this.client);
    this.adapt = adapt;

    return this;
  }

  then() {
    return this.parentBuilder;
  }

  build() {
    return new ForEachStepDef(this.itemsSelector, this.body, this.adapt);
  }
}
