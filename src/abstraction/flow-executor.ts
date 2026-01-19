import { IFlowDef } from "./flow-def";
import { IFlowExecution } from "./flow-execution";

export interface IFlowExecutor<TFlow extends IFlowDef> {
  execute(flowExecution: IFlowExecution<TFlow>): Promise<any>;
}
