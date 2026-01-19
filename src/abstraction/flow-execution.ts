import { IClient } from "./client";
import { IFlowDef, InferredContext } from "./flow-def";

export interface IFlowExecution<TFlowDef extends IFlowDef = IFlowDef> {
  readonly client: IClient;
  readonly flowDef: TFlowDef;
  readonly context: InferredContext<TFlowDef>;

  start(): Promise<void>;
  requestStop(): void;
  waitUntilFinished(): Promise<any>;

  onStopRequested(action: () => any): void;
  onFinished(action: () => any): void;
}
