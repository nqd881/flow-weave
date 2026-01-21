import { FlowCtor, FlowDefId, IFlowDef, IFlowRegistry } from "../abstraction";

export class FlowRegistry implements IFlowRegistry {
  private flows = new Map<FlowDefId, IFlowDef>();
  register<TFlow extends IFlowDef>(flow: TFlow): void {
    this.flows.set(flow.id, flow);
  }

  get<TFlow extends IFlowDef = IFlowDef>(
    id: FlowDefId,
    kind?: FlowCtor<TFlow>,
  ): TFlow | undefined {
    const flow = this.flows.get(id);

    if (!flow) return;

    if (kind && (flow.constructor as FlowCtor).kind !== kind) return; // prevent kind mismatch

    return flow as TFlow;
  }

  has(id: FlowDefId) {
    return this.flows.has(id);
  }

  list() {
    return [...this.flows.values()];
  }
}
