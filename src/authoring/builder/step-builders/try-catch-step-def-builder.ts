import type { IFlowDef, IFlowContext } from "../../../contracts";
import type { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { TryCatchBranchRequiredError } from "../../validation-errors";
import { StepDefMetadata, TryCatchStepDef } from "../../../flow/step-defs";
import { Branch, ContextAdapter } from "../../../flow/types";
import { IStepDefBuilder } from "./step-def-builder";

export class TryCatchStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TTryContext extends IFlowContext = IFlowContext,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> implements IStepDefBuilder<TryCatchStepDef<TContext, TTryContext, any>> {
  protected catchBranch?: Branch<TContext, any, [unknown]>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly weaver: TWeaver,
    protected readonly tryBranch: Branch<TContext, TTryContext>,
  ) {}

  catch(
    catchFlow: IFlowDef<TContext> | FlowDefFactory<TWeaver, TContext>,
    adapt?: ContextAdapter<TContext, TContext, [unknown]>,
  ): this;
  catch<TCatchContext extends IFlowContext>(
    catchFlow:
      | IFlowDef<TCatchContext>
      | FlowDefFactory<TWeaver, TCatchContext>,
    adapt: ContextAdapter<TContext, TCatchContext, [unknown]>,
  ): this;
  catch<TCatchContext extends IFlowContext>(
    catchFlow:
      | IFlowDef<TCatchContext>
      | FlowDefFactory<TWeaver, TCatchContext>,
    adapt?: ContextAdapter<TContext, TCatchContext, [unknown]>,
  ): this {
    if (typeof catchFlow !== "function") {
      this.catchBranch = { flow: catchFlow, adapt };
      return this;
    }

    const catchBranch = catchFlow(this.weaver);
    this.catchBranch = { flow: catchBranch, adapt };

    return this;
  }

  end(): TParentBuilder {
    return this.parentBuilder;
  }

  build(
    metadata?: StepDefMetadata<TContext>,
  ): TryCatchStepDef<TContext, TTryContext, any> {
    if (!this.catchBranch) {
      throw new TryCatchBranchRequiredError();
    }

    return new TryCatchStepDef(
      this.tryBranch,
      this.catchBranch,
      metadata,
    );
  }
}
