import { IFlowDef, IFlowRegistry } from "../abstraction";

export class FlowRegistry implements IFlowRegistry {
  protected flowMap = new Map<string, IFlowDef>();

  registerFlowDef(flowDef: IFlowDef): void {
    this.flowMap.set(flowDef.id, flowDef);
  }

  getFlowDef(id: string): IFlowDef | undefined {
    return this.flowMap.get(id);
  }
}
