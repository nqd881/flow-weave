import { IClient, IFlowEngine, InferredContext } from "../abstraction";
import { SagaDef } from "./saga-def";
import { SagaExecution } from "./saga-execution";
import { SagaExecutor } from "./saga-executor";

export class SagaEngine implements IFlowEngine {
  readonly flowType = SagaDef.type;

  createFlowExecution<TFlow extends SagaDef>(
    client: IClient,
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): SagaExecution<TFlow> {
    return new SagaExecution(client, new SagaExecutor(), flowDef, context);
  }
}
