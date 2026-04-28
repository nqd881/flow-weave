import type { RuntimeBuilder } from "../runtime/runtime-builder";
import type {
  WeaverBuilder,
  WeaverExtensions,
} from "../authoring/builder/weaver-builder";

export interface FlowPlugin<TExtensions extends WeaverExtensions = {}> {
  readonly id: string;
  readonly dependsOn?: string[];

  installWeaver<TCurrentExtensions extends WeaverExtensions>(
    builder: WeaverBuilder<TCurrentExtensions>,
  ): WeaverBuilder<TCurrentExtensions & TExtensions>;
  installRuntime(builder: RuntimeBuilder): void;
}
