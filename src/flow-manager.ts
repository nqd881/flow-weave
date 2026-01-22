import {
  FlowCtor,
  FlowDefId,
  IFlowDef,
  IFlowExecution,
  InferredContext,
} from "./abstraction";
import { Client } from "./client";
import { FlowRegistry } from "./base";

export type FlowRunOptions<TFlow extends IFlowDef> = {
  kind?: FlowCtor<TFlow>;
  configure?: (execution: IFlowExecution<TFlow>) => void;
  autoStart?: boolean;
};

export class FlowManager {
  constructor(
    private _client: Client = Client.defaultClient(),
    private _registry: FlowRegistry = new FlowRegistry(),
  ) {}

  get client() {
    return this._client;
  }

  get registry() {
    return this._registry;
  }

  useClient(client: Client) {
    this._client = client;
    return this;
  }

  useRegistry(registry: FlowRegistry) {
    this._registry = registry;
    return this;
  }

  async run<TFlow extends IFlowDef>(
    flowDefOrId: TFlow | FlowDefId,
    context: InferredContext<TFlow>,
    options?: FlowRunOptions<TFlow>,
  ): Promise<IFlowExecution<TFlow>> {
    const flowDef =
      typeof flowDefOrId === "string"
        ? this._registry.get(flowDefOrId as FlowDefId, options?.kind)
        : flowDefOrId;

    if (!flowDef) throw new Error("Flow definition not found");

    const execution = this._client.createFlowExecution(flowDef, context);

    options?.configure?.(execution);

    if (options?.autoStart ?? true) {
      await execution.start();
    }

    return execution;
  }
}
