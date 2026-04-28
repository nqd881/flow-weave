import {
  CONTEXT_TYPE,
  FlowDefId,
  FlowKind,
  IFlowContext,
  IStepDef,
} from "../contracts";
import { FlowDefMetadata, FlowDefWithHooks } from "./flow-metadata";

export class FlowDef<
  TContext extends IFlowContext = IFlowContext,
> implements FlowDefWithHooks<TContext> {
  static readonly flowKind: FlowKind = FlowDef;

  readonly [CONTEXT_TYPE]: TContext;

  public readonly hooks?: FlowDefMetadata<TContext>["hooks"];

  constructor(
    public readonly id: FlowDefId,
    public readonly steps: IStepDef<TContext>[],
    metadata?: FlowDefMetadata<TContext>,
  ) {
    this.hooks = metadata?.hooks;
  }
}
