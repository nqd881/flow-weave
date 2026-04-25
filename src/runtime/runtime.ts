import {
  IFlowDef,
  InferredContext,
  IRuntime,
} from "../contracts";
import { BaseExecution } from "./execution/base-execution";
import { BaseFlowRuntime } from "./providers/base-flow-runtime";
import { FlowExecutionOf } from "./types/flow-execution-of";
import { FlowRuntimeRegistry } from "./flow-runtime-registry";
import { registerBuiltInRuntimeComponents } from "./built-ins/register-built-in-runtime-components";
import {
  FlowRuntimeNotFoundError,
  NestedChildFlowBaseRuntimeRequiredError,
} from "./runtime-errors";

function resolveFlowRuntime<TFlow extends IFlowDef>(
  registry: FlowRuntimeRegistry,
  flowDef: TFlow,
) {
  const flowRuntime = registry.resolve(flowDef);

  if (!flowRuntime) {
    throw new FlowRuntimeNotFoundError();
  }

  return flowRuntime;
}

export class Runtime implements IRuntime {
  static default() {
    const flowRuntimeRegistry = new FlowRuntimeRegistry();

    registerBuiltInRuntimeComponents(flowRuntimeRegistry);

    return new Runtime(flowRuntimeRegistry);
  }

  protected readonly flowRuntimeRegistry: FlowRuntimeRegistry;

  constructor(flowRuntimeRegistry: FlowRuntimeRegistry) {
    this.flowRuntimeRegistry = flowRuntimeRegistry;
    this.flowRuntimeRegistry.bind(this);
  }

  createFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): FlowExecutionOf<TFlow> {
    const flowRuntime = resolveFlowRuntime(this.flowRuntimeRegistry, flowDef);

    return flowRuntime.createFlowExecution(flowDef, context) as FlowExecutionOf<TFlow>;
  }

  createFlowExecutionWithParent<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
    parentExecution?: BaseExecution,
  ): FlowExecutionOf<TFlow> {
    const flowRuntime = resolveFlowRuntime(this.flowRuntimeRegistry, flowDef);

    if (!(flowRuntime instanceof BaseFlowRuntime)) {
      throw new NestedChildFlowBaseRuntimeRequiredError();
    }

    return flowRuntime.createFlowExecutionWithParent(
      flowDef,
      context,
      parentExecution,
    ) as FlowExecutionOf<TFlow>;
  }

  canRun(flowDef: IFlowDef): boolean {
    return !!this.flowRuntimeRegistry.resolve(flowDef);
  }
}
