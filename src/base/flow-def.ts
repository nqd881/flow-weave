import { v4 } from "uuid";
import {
  CONTEXT_TYPE,
  FlowCtor,
  FlowDefId,
  IFlowDef,
  IFlowExecutionContext,
  IStepDef,
} from "../abstraction";

export class FlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> implements IFlowDef<TContext> {
  static readonly kind: FlowCtor = FlowDef;

  readonly [CONTEXT_TYPE]: TContext;

  public readonly id: FlowDefId;

  constructor(
    public readonly steps: IStepDef<TContext>[],
    id?: FlowDefId,
  ) {
    this.id = id ?? v4();
  }
}
