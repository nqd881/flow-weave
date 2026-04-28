import { IFlowContext, IFlowDef, IStepDef } from "../../contracts";
import { StepDefMetadata } from "../../flow/step-defs";

// ── Flow Reference ──
// Accepts either a raw IFlowDef or a @Flow-decorated class
export type FlowClass<TContext extends IFlowContext = IFlowContext> =
  (abstract new (...args: any[]) => unknown) & {
    readonly flowDef: IFlowDef<TContext>;
  };

export type WithFlowDef<
  TTarget extends abstract new (...args: any[]) => unknown,
  TFlow extends IFlowDef = IFlowDef,
> = TTarget & {
  readonly flowDef: TFlow;
};

export type FlowRef<TContext extends IFlowContext = IFlowContext> =
  | IFlowDef<TContext>
  | FlowClass<TContext>;

// ── Step Entry ──
// Internal representation of a step before compilation by @Flow
export type StepBuildFn<TContext extends IFlowContext = IFlowContext> = (
  metadata?: StepDefMetadata<TContext>,
) => IStepDef<TContext>;

export type StepEntry = {
  order: number;
  propertyKey: string | symbol;
  stepMetadata?: StepDefMetadata;
  build: StepBuildFn<any>;
  /** Open extension point — custom class decorators can read this */
  extensions: Record<string, unknown>;
};

// ── Pending Member Data ──
// Accumulated by sub-decorators (@Branch, @Retry, etc.) before
// the main step decorator consumes them
export type PendingMemberData = {
  stepMetadata: Partial<StepDefMetadata>;
  [key: string]: unknown;
};
