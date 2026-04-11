import {
  IFlowExecutionFactory,
  IFlowExecution,
  IFlowRuntime,
  InferredContext,
} from "../contracts";
import { FlowDef } from "./flow-def";
import { FlowExecution } from "./flow-execution";
import { FlowExecutor } from "./flow-executor";

export class FlowExecutionFactory implements IFlowExecutionFactory<FlowDef> {
  readonly flowKind = FlowDef;

  createFlowExecution<TFlow extends FlowDef>(
    runtime: IFlowRuntime,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow> {
    return new FlowExecution(runtime, new FlowExecutor(), flowDef, context);
  }
}
