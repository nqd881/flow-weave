import { IFlowExecutionContext } from "./flow-execution-context";
import { IStepDef } from "./step-def";

export const CONTEXT_TYPE = Symbol.for("CONTEXT_TYPE");

export interface IFlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> {
  readonly [CONTEXT_TYPE]: TContext;

  readonly id: string;
  readonly steps: IStepDef<TContext>[];
}

export type InferredContext<T> = T extends { [CONTEXT_TYPE]: infer Context }
  ? Context
  : never;
