export class PluginDependencyMissingError extends Error {
  constructor(pluginId: string, dependency: string) {
    super(
      `Plugin '${pluginId}' depends on '${dependency}', which is not installed.`,
    );
  }
}
