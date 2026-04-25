import {
  IFlowDef,
  IFlowRuntime,
} from "../contracts";
import type { FlowPlugin } from "../plugin/flow-plugin";
import { PluginDependencyMissingError } from "../plugin/plugin-errors";
import { FlowRuntimeRegistry } from "./flow-runtime-registry";
import { registerBuiltInRuntimeComponents } from "./built-ins/register-built-in-runtime-components";
import { Runtime } from "./runtime";

export class RuntimeBuilder {
  static default() {
    return new RuntimeBuilder().withBuiltIns();
  }

  protected readonly flowRuntimeRegistry =
    new FlowRuntimeRegistry();
  protected readonly installedPluginIds = new Set<string>();

  withBuiltIns() {
    registerBuiltInRuntimeComponents(this.flowRuntimeRegistry);

    return this;
  }

  withFlowRuntime<TFlow extends IFlowDef>(
    flowRuntime: IFlowRuntime<TFlow>,
  ) {
    this.flowRuntimeRegistry.register(flowRuntime);
    return this;
  }

  use(plugin: FlowPlugin<any>) {
    if (this.installedPluginIds.has(plugin.id)) {
      return this;
    }

    this.ensurePluginDependencies(plugin);
    plugin.installRuntime(this);
    this.installedPluginIds.add(plugin.id);

    return this;
  }

  build() {
    return new Runtime(this.flowRuntimeRegistry.clone());
  }

  protected ensurePluginDependencies(plugin: FlowPlugin<any>) {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!this.installedPluginIds.has(dependency)) {
        throw new PluginDependencyMissingError(plugin.id, dependency);
      }
    }
  }
}
