import {
  IFlowExecution,
  IFlowExecutor,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
} from "../../contracts";
import { StepHooks } from "../../flow/step-defs/step-metadata";
import { registerBuiltInStepExecutors } from "../../runtime/built-ins/register-built-in-step-executors";
import { BaseExecution } from "../../runtime/execution/base-execution";
import { StepExecutorRegistry } from "../../runtime/step-executor-registry";
import { BaseFlowRuntime } from "../../runtime/providers/base-flow-runtime";
import { SagaDef } from "../saga-def";
import { SagaExecution } from "./saga-execution";
import { SagaStepExecution } from "./saga-step-execution";

export class SagaFlowRuntime extends BaseFlowRuntime<SagaDef> {
  readonly flowKind = SagaDef;

  constructor(stepExecutorRegistry?: StepExecutorRegistry) {
    super(stepExecutorRegistry);

    if (stepExecutorRegistry) {
      return;
    }

    registerBuiltInStepExecutors(this.stepExecutorRegistry);
  }

  override clone() {
    return new SagaFlowRuntime(this.cloneStepExecutorRegistry());
  }

  protected override createFlowExecutionInstance<TFlow extends SagaDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
    executor: IFlowExecutor<TFlow>,
    parentExecution?: BaseExecution,
  ): IFlowExecution<TFlow> {
    return new SagaExecution<TFlow>(
      this as any,
      executor,
      flowDef,
      context,
      parentExecution,
    );
  }

  protected override createStepExecutionInstance<TStep extends IStepDef>(
    flowExecution: IFlowExecution<SagaDef>,
    stepDef: TStep,
    executor: IStepExecutor<TStep>,
  ): IStepExecution<TStep> {
    return new SagaStepExecution<TStep, SagaDef>(
      flowExecution as SagaExecution<SagaDef>,
      (flowDef, context, parentExecution) =>
        this.getRuntimeOrThrow().createFlowExecutionWithParent(
          flowDef,
          context,
          parentExecution,
        ),
      executor,
      stepDef,
      flowExecution.context as unknown as InferredContext<TStep>,
      {
        flowHooks: this.getFlowHooks(flowExecution.flowDef) as StepHooks<
          InferredContext<TStep>
        >,
      },
      flowExecution as unknown as BaseExecution,
    );
  }
}
