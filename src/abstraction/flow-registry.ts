import { FlowDefId, IFlowDef } from "./flow-def";

export interface IFlowRegistry {
  register<TFlow extends IFlowDef>(flow: TFlow): void;
  get<TFlow extends IFlowDef = IFlowDef>(id: FlowDefId): TFlow | undefined;
  has(id: FlowDefId): boolean;
  list(): IFlowDef[];
}
