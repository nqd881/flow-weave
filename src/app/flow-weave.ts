import {
  ExtendedWeaver,
  WeaverBuilder,
  WeaverExtensions,
} from "../authoring/weaver-builder";
import { Runtime } from "../runtime";
import { RuntimeBuilder } from "../runtime/runtime-builder";
import type { FlowPlugin } from "../plugin/flow-plugin";

export class FlowWeaveApp<TExtensions extends WeaverExtensions = {}> {
  constructor(
    protected readonly flowWeaver: ExtendedWeaver<TExtensions>,
    protected readonly flowRuntime: Runtime,
  ) {}

  weaver() {
    return this.flowWeaver;
  }

  runtime() {
    return this.flowRuntime;
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
    );
  }
}

export class FlowWeave {
  static create() {
    return new FlowWeaveBuilder();
  }
}
