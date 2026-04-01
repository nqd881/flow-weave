import { v4 } from "uuid";
import {
  CONTEXT_TYPE,
  FlowCtor,
  FlowDefId,
  IFlowDef,
  IFlowExecutionContext,
  IStepDef,
} from "../abstraction";
import { StepHooks } from "./step-defs";

export type FlowOptions<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> = {
  hooks?: StepHooks<TContext>;
};

export interface IHookedFlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends IFlowDef<TContext> {
  readonly hooks?: StepHooks<TContext>;
}

export class FlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> implements IHookedFlowDef<TContext> {
  static readonly kind: FlowCtor = FlowDef;

  readonly [CONTEXT_TYPE]: TContext;

  public readonly id: FlowDefId;
  public readonly hooks?: StepHooks<TContext>;

  constructor(
    public readonly steps: IStepDef<TContext>[],
    id?: FlowDefId,
    options?: FlowOptions<TContext>,
  ) {
    this.id = id ?? v4();
    this.hooks = options?.hooks;
  }
}
