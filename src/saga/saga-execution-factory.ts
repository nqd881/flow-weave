import {
  IFlowExecutionFactory,
  IFlowRuntime,
  InferredContext,
} from "../contracts";
import { SagaDef } from "./saga-def";
import { SagaExecution } from "./saga-execution";
import { SagaExecutor } from "./saga-executor";

export class SagaExecutionFactory implements IFlowExecutionFactory<SagaDef> {
  readonly flowKind = SagaDef;

  createFlowExecution<TFlow extends SagaDef>(
    runtime: IFlowRuntime,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): SagaExecution<TFlow> {
    return new SagaExecution(runtime, new SagaExecutor(), flowDef, context);
  }
}
