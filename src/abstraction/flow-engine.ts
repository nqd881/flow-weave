import { IClient } from "./client";
import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IFlowExecutionContext } from "./flow-execution-context";

export interface IFlowEngine {
  readonly flowType: string;

  createFlowExecution(
    client: IClient,
    flowDef: IFlowDef,
    context: IFlowExecutionContext,
  ): IFlowExecution;
}
