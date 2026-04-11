import { FlowKind, IFlowDef, IFlowExecutionFactory } from "../contracts";

export class FlowExecutionFactoryRegistry {
  protected readonly flowExecutionFactoryMap = new Map<
    FlowKind,
    IFlowExecutionFactory
  >();

  register(executionFactory: IFlowExecutionFactory<any>) {
    this.flowExecutionFactoryMap.set(executionFactory.flowKind, executionFactory);
  }

  resolve<TFlow extends IFlowDef>(
    flowDef: TFlow,
  ): IFlowExecutionFactory<TFlow> | undefined {
    const flowKind =
      (flowDef.constructor as FlowKind).flowKind ?? flowDef.constructor;

    return this.flowExecutionFactoryMap.get(flowKind) as
      | IFlowExecutionFactory<TFlow>
      | undefined;
  }

  has(flowKind: FlowKind) {
    return this.flowExecutionFactoryMap.has(flowKind);
  }

  list() {
    return [...this.flowExecutionFactoryMap.values()];
  }

  clone() {
    const registry = new FlowExecutionFactoryRegistry();

    for (const executionFactory of this.list()) {
      registry.register(executionFactory);
    }

    return registry;
  }
}
