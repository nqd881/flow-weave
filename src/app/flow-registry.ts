import { FlowDefId, FlowKind, IFlowDef, IFlowRegistry } from "../contracts";

export class FlowRegistry implements IFlowRegistry {
  private flows = new Map<FlowDefId, IFlowDef>();
  register<TFlow extends IFlowDef>(flow: TFlow): void {
    this.flows.set(flow.id, flow);
  }

  get<TFlow extends IFlowDef = IFlowDef>(
    id: FlowDefId,
    flowKind?: FlowKind<TFlow>,
  ): TFlow | undefined {
    const flow = this.flows.get(id);

    if (!flow) return;

    if (flowKind && (flow.constructor as FlowKind).flowKind !== flowKind) return;

    return flow as TFlow;
  }

  has(id: FlowDefId) {
    return this.flows.has(id);
  }

  list() {
    return [...this.flows.values()];
  }
}
