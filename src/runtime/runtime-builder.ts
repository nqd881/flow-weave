import {
  IFlowDef,
  IFlowExecutionFactory,
  IStepDef,
  StepDefCtor,
  StepExecutorFactory,
} from "../contracts";
import type { FlowPlugin } from "../plugin/flow-plugin";
import { FlowExecutionFactoryRegistry } from "./flow-execution-factory-registry";
import { registerBuiltInRuntimeComponents } from "../flow/runtime-registration";
import { Runtime } from "./runtime";
import { StepExecutorRegistry } from "./step-executor-registry";

export class RuntimeBuilder {
  static default() {
    return new RuntimeBuilder().withBuiltIns();
  }

  protected readonly flowExecutionFactoryRegistry =
    new FlowExecutionFactoryRegistry();
  protected readonly stepExecutorRegistry = new StepExecutorRegistry();
  protected readonly installedPluginIds = new Set<string>();

  withBuiltIns() {
    registerBuiltInRuntimeComponents(
      this.flowExecutionFactoryRegistry,
      this.stepExecutorRegistry,
    );

    return this;
  }

  withExecutionFactory<TFlow extends IFlowDef>(
    executionFactory: IFlowExecutionFactory<TFlow>,
  ) {
    this.flowExecutionFactoryRegistry.register(executionFactory);
    return this;
  }

  withStepExecutor<TStep extends IStepDef>(
    stepType: StepDefCtor<TStep>,
    factory: StepExecutorFactory<TStep>,
  ) {
    this.stepExecutorRegistry.register(stepType, factory);
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
    return new Runtime(
      this.flowExecutionFactoryRegistry.clone(),
      this.stepExecutorRegistry.clone(),
    );
  }

  protected ensurePluginDependencies(plugin: FlowPlugin<any>) {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!this.installedPluginIds.has(dependency)) {
        throw new Error(
          `Plugin '${plugin.id}' depends on '${dependency}', which is not installed.`,
        );
      }
    }
  }
}
