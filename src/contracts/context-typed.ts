import { IFlowContext } from "./flow-context";

export const CONTEXT_TYPE = Symbol.for("CONTEXT_TYPE");

export interface IContextTyped<TContext extends IFlowContext> {
  readonly [CONTEXT_TYPE]: TContext;
}

export type InferredContext<T> =
  T extends IContextTyped<infer Context> ? Context : never;
