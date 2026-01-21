import { IFlowDef } from "./flow-def";

export interface IFlowRegistry {
  registerFlowDef(flowDef: IFlowDef): void;
  getFlowDef(id: string): IFlowDef | undefined;
}
