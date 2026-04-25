import { InferredContext } from "./context-typed";
import { IFlowDef, FlowKind } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IRuntime } from "./runtime";
import { IStepDef } from "./step-def";
import { IStepExecution } from "./step-execution";

export interface IFlowRuntime<
  TFlow extends IFlowDef = IFlowDef,
> {
  readonly flowKind: FlowKind<TFlow>;

  bind(runtime: IRuntime): void;

  createFlowExecution(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow>;

  createStepExecution<TStep extends IStepDef>(
    flowExecution: IFlowExecution<TFlow>,
    stepDef: TStep,
  ): IStepExecution<TStep>;

  clone(): IFlowRuntime<TFlow>;
}
