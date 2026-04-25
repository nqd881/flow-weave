import { FlowRuntimeRegistry } from "../flow-runtime-registry";
import { CoreFlowRuntime } from "../providers/core-flow-runtime";

export function registerBuiltInRuntimeComponents(
  flowRuntimeRegistry: FlowRuntimeRegistry,
) {
  flowRuntimeRegistry.register(new CoreFlowRuntime());
}
