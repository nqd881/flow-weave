import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { FlowExecutionStatus } from "./flow-execution-status";
import { IFlowRuntime } from "./flow-runtime";

export interface IFlowExecution<TFlowDef extends IFlowDef = IFlowDef> {
  readonly runtime: IFlowRuntime;
  readonly flowDef: TFlowDef;
  readonly context: InferredContext<TFlowDef>;

  getStatus(): FlowExecutionStatus;
  getError(): any;

  isStopRequested(): boolean;

  start(): Promise<void>;
  requestStop(): void;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
