import {
  FlowCtor,
  IClient,
  IFlowDef,
  IFlowEngine,
  IFlowExecution,
  InferredContext,
} from "./abstraction";
import { FlowEngine } from "./base";
import { SagaEngine } from "./saga";

export class Client implements IClient {
  static defaultClient() {
    const client = new Client();

    client.registerEngine(new FlowEngine());
    client.registerEngine(new SagaEngine());

    return client;
  }

  protected engineMap = new Map<FlowCtor, IFlowEngine<any>>();

  registerEngine(engine: IFlowEngine<any>) {
    this.engineMap.set(engine.flowKind, engine);
  }

  createFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow> {
    const flowKind =
      (flowDef.constructor as FlowCtor).kind ?? flowDef.constructor;

    const engine = this.engineMap.get(flowKind);

    if (!engine) throw new Error("Engine not found");

    return engine.createFlowExecution(this, flowDef, context);
  }
}
