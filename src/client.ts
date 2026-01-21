import {
  FlowType,
  IClient,
  IFlowDef,
  IFlowEngine,
  IFlowExecution,
  IFlowExecutionContext,
} from "./abstraction";

export class Client implements IClient {
  protected engineMap = new Map<FlowType, IFlowEngine>();

  registerEngine(engine: IFlowEngine) {
    this.engineMap.set(engine.flowType, engine);
  }

  createFlowExecution(
    flowDef: IFlowDef,
    context: IFlowExecutionContext,
  ): IFlowExecution {
    const engine = this.engineMap.get(flowDef.type);

    if (!engine) throw new Error("Engine not found");

    return engine.createFlowExecution(this, flowDef, context);
  }
}
