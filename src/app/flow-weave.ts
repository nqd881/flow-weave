import {
  ExtendedWeaver,
  WeaverBuilder,
  WeaverExtensions,
} from "../authoring/weaver-builder";
import {
  FlowDefId,
  FlowKind,
  IFlowDef,
  IFlowRegistry,
  InferredContext,
} from "../contracts";
import { Runtime } from "../runtime";
import { FlowExecutionOf } from "../runtime/types/flow-execution-of";
import { RuntimeBuilder } from "../runtime/runtime-builder";
import type { FlowPlugin } from "../plugin/flow-plugin";
import { FlowNotFoundError } from "./app-errors";
import { FlowRegistry } from "./flow-registry";

export class FlowWeaveApp<TExtensions extends WeaverExtensions = {}> {
  constructor(
    protected readonly flowWeaver: ExtendedWeaver<TExtensions>,
    protected readonly flowRuntime: Runtime,
    protected flowRegistry: IFlowRegistry,
  ) {}

  weaver() {
    return this.flowWeaver;
  }

  runtime() {
    return this.flowRuntime;
  }

  registry() {
    return this.flowRegistry;
  }

  setRegistry(registry: IFlowRegistry) {
    this.flowRegistry = registry;
    return this;
  }

  registerFlow<TFlow extends IFlowDef>(flow: TFlow) {
    this.flowRegistry.register(flow);
    return flow;
  }

  resolveFlow<TFlow extends IFlowDef = IFlowDef>(
    id: FlowDefId,
    flowKind?: FlowKind<TFlow>,
  ) {
    return this.flowRegistry.get(id, flowKind);
  }

  async run<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): Promise<FlowExecutionOf<TFlow>>;
  async run<TFlow extends IFlowDef>(
    id: FlowDefId,
    context: InferredContext<TFlow>,
    flowKind: FlowKind<TFlow>,
  ): Promise<FlowExecutionOf<TFlow>>;
  async run<TFlow extends IFlowDef>(
    flowOrId: TFlow | FlowDefId,
    context: InferredContext<TFlow>,
    flowKind?: FlowKind<TFlow>,
  ): Promise<FlowExecutionOf<TFlow>> {
    const flowDef =
      typeof flowOrId === "string"
        ? this.resolveFlow(flowOrId, flowKind)
        : flowOrId;

    if (!flowDef) {
      throw new FlowNotFoundError(flowOrId as FlowDefId);
    }

    const execution = this.flowRuntime.createFlowExecution(
      flowDef,
      context as InferredContext<TFlow>,
    ) as FlowExecutionOf<TFlow>;

    await execution.start();

    return execution;
  }
}

export class FlowWeaveBuilder<TExtensions extends WeaverExtensions = {}> {
  protected readonly runtimeBuilder = RuntimeBuilder.default();
  protected weaverBuilder: WeaverBuilder<any> = new WeaverBuilder();

  use<TPluginExtensions extends WeaverExtensions>(
    plugin: FlowPlugin<TPluginExtensions>,
  ): FlowWeaveBuilder<TExtensions & TPluginExtensions> {
    this.weaverBuilder = this.weaverBuilder.use(
      plugin,
    ) as WeaverBuilder<TExtensions & TPluginExtensions>;
    this.runtimeBuilder.use(plugin);

    return this as unknown as FlowWeaveBuilder<
      TExtensions & TPluginExtensions
    >;
  }

  build() {
    return new FlowWeaveApp<TExtensions>(
      this.weaverBuilder.build() as ExtendedWeaver<TExtensions>,
      this.runtimeBuilder.build(),
      new FlowRegistry(),
    );
  }
}

export class FlowWeave {
  static create() {
    return new FlowWeaveBuilder();
  }
}
