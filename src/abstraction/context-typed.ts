import { IFlowExecutionContext } from "./flow-execution-context";

export const CONTEXT_TYPE = Symbol.for("CONTEXT_TYPE");

export interface IContextTyped<TContext extends IFlowExecutionContext> {
  readonly [CONTEXT_TYPE]: TContext;
}

export type InferredContext<T> =
  T extends IContextTyped<infer Context> ? Context : never;
