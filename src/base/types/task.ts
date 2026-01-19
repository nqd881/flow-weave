import { IFlowExecutionContext } from "../../abstraction";

export type Task<TContext extends IFlowExecutionContext, TOutput = any> = (
  context: TContext
) => TOutput;

export type AnyTask = Task<IFlowExecutionContext>;

export type InferredTaskOutput<TTask extends Task<any>> = TTask extends Task<
  any,
  infer TOutput
>
  ? Awaited<TOutput>
  : never;
