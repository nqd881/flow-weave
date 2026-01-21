import { v4 } from "uuid";
import {
  CONTEXT_TYPE,
  FlowDefId,
  FlowType,
  IFlowDef,
  IFlowExecutionContext,
  IStepDef,
} from "../abstraction";

export class FlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> implements IFlowDef<TContext> {
  readonly [CONTEXT_TYPE]: TContext;

  static type: FlowType = "basic";

  public get type(): FlowType {
    return (this.constructor as any as FlowDef).type;
  }

  public readonly id: FlowDefId;

  constructor(
    public readonly steps: IStepDef<TContext>[],
    id?: FlowDefId,
  ) {
    this.id = id ?? v4();
  }
}
