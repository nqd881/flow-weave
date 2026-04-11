import { FlowDefId, FlowKind, IFlowDef } from "./flow-def";

export interface IFlowRegistry {
  register<TFlow extends IFlowDef>(flow: TFlow): void;
  get<TFlow extends IFlowDef = IFlowDef>(
    id: FlowDefId,
    flowKind?: FlowKind<TFlow>,
  ): TFlow | undefined;
  has(id: FlowDefId): boolean;
  list(): IFlowDef[];
}
