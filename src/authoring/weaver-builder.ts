import { Weaver } from "./weaver";
import type { FlowPlugin } from "../plugin/flow-plugin";
import { PluginDependencyMissingError } from "../plugin/plugin-errors";
import { WeaverMethodAlreadyDefinedError } from "./authoring-errors";

export type WeaverMethod = (...args: any[]) => any;

export type WeaverExtensions = Record<string, WeaverMethod>;

export type WeaverMethodFactory<
  TWeaver,
  TMethod extends WeaverMethod,
> = (weaver: TWeaver) => TMethod;

export type ExtendedWeaver<TExtensions extends WeaverExtensions = {}> =
  Weaver & TExtensions;

export class WeaverBuilder<TExtensions extends WeaverExtensions = {}> {
  protected readonly methodFactories = new Map<
    string,
    WeaverMethodFactory<any, WeaverMethod>
  >();
  protected readonly installedPluginIds = new Set<string>();

  extendMethod<K extends string, TMethod extends WeaverMethod>(
    name: K,
    factory: WeaverMethodFactory<ExtendedWeaver<TExtensions>, TMethod>,
  ): WeaverBuilder<TExtensions & Record<K, TMethod>> {
    if (name in Weaver.prototype || this.methodFactories.has(name)) {
      throw new WeaverMethodAlreadyDefinedError(name);
    }

    this.methodFactories.set(
      name,
      factory as WeaverMethodFactory<any, WeaverMethod>,
    );

    return this as unknown as WeaverBuilder<
      TExtensions & Record<K, TMethod>
    >;
  }

  use<TPluginExtensions extends WeaverExtensions>(
    plugin: FlowPlugin<TPluginExtensions>,
  ): WeaverBuilder<TExtensions & TPluginExtensions> {
    if (this.installedPluginIds.has(plugin.id)) {
      return this as unknown as WeaverBuilder<
        TExtensions & TPluginExtensions
      >;
    }

    this.ensurePluginDependencies(plugin);

    const nextBuilder = plugin.installWeaver(
      this as unknown as WeaverBuilder<TExtensions>,
    );

    for (const pluginId of this.installedPluginIds) {
      nextBuilder.installedPluginIds.add(pluginId);
    }

    nextBuilder.installedPluginIds.add(plugin.id);

    return nextBuilder as unknown as WeaverBuilder<
      TExtensions & TPluginExtensions
    >;
  }

  build(): ExtendedWeaver<TExtensions> {
    const weaver = new Weaver() as ExtendedWeaver<TExtensions>;

    for (const [name, factory] of this.methodFactories) {
      Object.defineProperty(weaver, name, {
        value: factory(weaver),
        enumerable: false,
      });
    }

    return weaver;
  }

  protected ensurePluginDependencies(plugin: FlowPlugin<any>) {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!this.installedPluginIds.has(dependency)) {
        throw new PluginDependencyMissingError(plugin.id, dependency);
      }
    }
  }
}
