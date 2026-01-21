import { IClient } from "./client";
import { InferredContext } from "./context-typed";
import { IFlowDef } from "./flow-def";
import { FlowExecutionStatus } from "./flow-execution-status";

export interface IFlowExecution<TFlowDef extends IFlowDef = IFlowDef> {
  readonly client: IClient;
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
