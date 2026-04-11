import {
  CONTEXT_TYPE,
  IFlowContext,
  IStepDef,
} from "../../contracts";
import { v4 } from "uuid";
import { StepDefMetadata, StepDefWithHooks, StepHooks } from "./step-metadata";

export class StepDef<
  TContext extends IFlowContext = IFlowContext,
> implements StepDefWithHooks<TContext> {
  readonly [CONTEXT_TYPE]: TContext;

  public readonly id: string;

  public readonly hooks?: StepHooks<TContext>;

  constructor(metadata?: StepDefMetadata<TContext>) {
    this.id = metadata?.id ?? v4();
    this.hooks = metadata?.hooks;
  }
}
