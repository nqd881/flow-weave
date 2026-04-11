import {
  IFlowDef,
  IFlowExecution,
  IFlowRuntime,
  InferredContext,
  IStepDef,
  IStepExecutor,
} from "../contracts";
import { FlowExecutionOf } from "../flow";
import { FlowExecutionFactoryRegistry } from "./flow-execution-factory-registry";
import { registerBuiltInRuntimeComponents } from "../flow/runtime-registration";
import { StepExecutorRegistry } from "./step-executor-registry";

export class Runtime implements IFlowRuntime {
  static default() {
    const flowExecutionFactoryRegistry = new FlowExecutionFactoryRegistry();
    const stepExecutorRegistry = new StepExecutorRegistry();

    registerBuiltInRuntimeComponents(
      flowExecutionFactoryRegistry,
      stepExecutorRegistry,
    );

    return new Runtime(flowExecutionFactoryRegistry, stepExecutorRegistry);
  }

  constructor(
    protected readonly flowExecutionFactoryRegistry: FlowExecutionFactoryRegistry,
    protected readonly stepExecutorRegistry: StepExecutorRegistry,
  ) {}

  resolveStepExecutor<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecutor<TStep> | undefined {
    return this.stepExecutorRegistry.resolve(stepDef);
  }

  createFlowExecution<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): FlowExecutionOf<TFlow> {
    const executionFactory = this.flowExecutionFactoryRegistry.resolve(flowDef);

    if (!executionFactory) {
      throw new Error("Execution factory not found");
    }

    return executionFactory.createFlowExecution(
      this,
      flowDef,
      context,
    ) as FlowExecutionOf<TFlow>;
  }

  canRun(flowDef: IFlowDef): boolean {
    return !!this.flowExecutionFactoryRegistry.resolve(flowDef);
  }
}
