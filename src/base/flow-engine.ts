import {
  IClient,
  IFlowDef,
  IFlowEngine,
  IFlowExecution,
  InferredContext,
} from "../abstraction";
import { FlowDef } from "./flow-def";
import { FlowExecution } from "./flow-execution";
import { FlowExecutor } from "./flow-executor";

export class FlowEngine implements IFlowEngine {
  readonly flowType = FlowDef.type;

  createFlowExecution<TFlow extends IFlowDef>(
    client: IClient,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow> {
    return new FlowExecution(client, new FlowExecutor(), flowDef, context);
  }
}
