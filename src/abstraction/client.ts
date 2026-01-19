import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";
import { IFlowExecutionContext } from "./flow-execution-context";

export interface IClient {
  createFlowExecution(
    flowDef: IFlowDef,
    context: IFlowExecutionContext
  ): IFlowExecution;
}
