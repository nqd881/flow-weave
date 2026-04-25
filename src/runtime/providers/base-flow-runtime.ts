import {
  FlowKind,
  IFlowContext,
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
  IFlowRuntime,
  InferredContext,
  IRuntime,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepDefCtor,
  StepExecutorFactory,
} from "../../contracts";
import { FlowDefWithHooks } from "../../flow/flow-metadata";
import { StepHooks } from "../../flow/step-defs/step-metadata";
import { BaseExecution } from "../execution/base-execution";
import { FlowExecution } from "../execution/flow-execution";
import { FlowExecutor } from "../execution/flow-executor";
import { StepExecution } from "../execution/step-execution";
import { StepExecutorRegistry } from "../step-executor-registry";
import {
  FlowRuntimeAlreadyBoundError,
  FlowRuntimeBindingCapabilityError,
  FlowRuntimeNotBoundError,
  MissingStepExecutorError,
} from "../runtime-errors";

type ParentAwareRuntime = IRuntime & {
  createFlowExecutionWithParent<TFlow extends IFlowDef>(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
    parentExecution?: BaseExecution,
  ): IFlowExecution<TFlow>;
};

export abstract class BaseFlowRuntime<
  TFlow extends IFlowDef = IFlowDef,
> implements IFlowRuntime<TFlow> {
  abstract readonly flowKind: FlowKind<TFlow>;

  protected runtime?: ParentAwareRuntime;
  protected readonly stepExecutorRegistry: StepExecutorRegistry;

  constructor(stepExecutorRegistry: StepExecutorRegistry = new StepExecutorRegistry()) {
    this.stepExecutorRegistry = stepExecutorRegistry;
  }

  abstract clone(): IFlowRuntime<TFlow>;

  bind(runtime: IRuntime) {
    if (typeof (runtime as ParentAwareRuntime).createFlowExecutionWithParent !== "function") {
      throw new FlowRuntimeBindingCapabilityError();
    }

    if (this.runtime && this.runtime !== runtime) {
      throw new FlowRuntimeAlreadyBoundError();
    }

    this.runtime = runtime as ParentAwareRuntime;
  }

  createFlowExecution(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
  ): IFlowExecution<TFlow> {
    return this.createFlowExecutionWithParent(flowDef, context);
  }

  createFlowExecutionWithParent(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
    parentExecution?: BaseExecution,
  ): IFlowExecution<TFlow> {
    return this.createFlowExecutionInstance(
      flowDef,
      context,
      this.createFlowExecutor(flowDef),
      parentExecution,
    );
  }

  createStepExecution<TStep extends IStepDef>(
    flowExecution: IFlowExecution<TFlow>,
    stepDef: TStep,
  ): IStepExecution<TStep> {
    return this.createStepExecutionInstance(
      flowExecution,
      stepDef,
      this.resolveRequiredStepExecutor(stepDef),
    );
  }

  withStepExecutor<TStep extends IStepDef>(
    stepType: StepDefCtor<TStep>,
    factory: StepExecutorFactory<TStep>,
  ) {
    this.stepExecutorRegistry.register(stepType, factory);
    return this;
  }

  protected cloneStepExecutorRegistry() {
    return this.stepExecutorRegistry.clone();
  }

  protected createFlowExecutor(_flowDef: TFlow): IFlowExecutor<TFlow> {
    return new FlowExecutor<TFlow>();
  }

  protected createFlowExecutionInstance(
    flowDef: TFlow,
    context: InferredContext<TFlow>,
    executor: IFlowExecutor<TFlow>,
    parentExecution?: BaseExecution,
  ): IFlowExecution<TFlow> {
    return new FlowExecution(this, executor, flowDef, context, parentExecution);
  }

  protected createStepExecutionInstance<TStep extends IStepDef>(
    flowExecution: IFlowExecution<TFlow>,
    stepDef: TStep,
    executor: IStepExecutor<TStep>,
  ): IStepExecution<TStep> {
    return new StepExecution<TStep>(
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

  protected resolveStepExecutor<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecutor<TStep> | undefined {
    return this.stepExecutorRegistry.resolve(stepDef);
  }

  protected resolveRequiredStepExecutor<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecutor<TStep> {
    const executor = this.resolveStepExecutor(stepDef);

    if (!executor) {
      throw new MissingStepExecutorError(stepDef.constructor.name);
    }

    return executor;
  }

  protected getRuntimeOrThrow(): ParentAwareRuntime {
    if (!this.runtime) {
      throw new FlowRuntimeNotBoundError();
    }

    return this.runtime;
  }

  protected getFlowHooks(flowDef: TFlow) {
    if (!("hooks" in flowDef)) return;

    return (flowDef as FlowDefWithHooks<IFlowContext>).hooks;
  }
}
