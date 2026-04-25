import {
  FlowKind,
  IFlowDef,
  IFlowRuntime,
  IRuntime,
} from "../contracts";

export class FlowRuntimeRegistry {
  protected readonly flowRuntimeMap = new Map<
    FlowKind,
    IFlowRuntime
  >();

  register(flowRuntime: IFlowRuntime<any>) {
    this.flowRuntimeMap.set(flowRuntime.flowKind, flowRuntime);
  }

  resolve<TFlow extends IFlowDef>(
    flowDef: TFlow,
  ): IFlowRuntime<TFlow> | undefined {
    const flowKind =
      (flowDef.constructor as FlowKind).flowKind ?? flowDef.constructor;

    return this.flowRuntimeMap.get(flowKind) as
      | IFlowRuntime<TFlow>
      | undefined;
  }

  has(flowKind: FlowKind) {
    return this.flowRuntimeMap.has(flowKind);
  }

  list() {
    return [...this.flowRuntimeMap.values()];
  }

  bind(runtime: IRuntime) {
    for (const flowRuntime of this.list()) {
      flowRuntime.bind(runtime);
    }
  }

  clone() {
    const registry = new FlowRuntimeRegistry();

    for (const flowRuntime of this.list()) {
      registry.register(flowRuntime.clone());
    }

    return registry;
  }
}
