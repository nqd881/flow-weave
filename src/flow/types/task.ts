import { IFlowContext } from "../../contracts";

export type Task<TContext extends IFlowContext, TOutput = any> = (
  context: TContext
) => TOutput;

export type AnyTask = Task<IFlowContext>;

export type InferredTaskOutput<TTask extends Task<any>> = TTask extends Task<
  any,
  infer TOutput
>
  ? Awaited<TOutput>
  : never;
