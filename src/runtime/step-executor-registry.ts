import {
  IStepDef,
  IStepExecutor,
  StepDefCtor,
  StepExecutorFactory,
} from "../contracts";

export class StepExecutorRegistry {
  protected readonly stepExecutorFactoryMap = new Map<
    StepDefCtor,
    StepExecutorFactory
  >();

  register<TStep extends IStepDef>(
    stepType: StepDefCtor<TStep>,
    factory: StepExecutorFactory<TStep>,
  ) {
    this.stepExecutorFactoryMap.set(stepType, factory);
  }

  resolve<TStep extends IStepDef>(
    stepDef: TStep,
  ): IStepExecutor<TStep> | undefined {
    let stepType = stepDef.constructor as StepDefCtor<TStep> | undefined;
    let factory: StepExecutorFactory<TStep> | undefined;

    while (stepType) {
      factory = this.stepExecutorFactoryMap.get(stepType) as
        | StepExecutorFactory<TStep>
        | undefined;

      if (factory) break;

      const parentPrototype = Object.getPrototypeOf(stepType.prototype);

      if (!parentPrototype || parentPrototype === Object.prototype) {
        stepType = undefined;
        continue;
      }

      stepType = parentPrototype.constructor as StepDefCtor<TStep> | undefined;
    }

    if (!factory) return;

    return factory() as IStepExecutor<TStep>;
  }

  has(stepType: StepDefCtor) {
    return this.stepExecutorFactoryMap.has(stepType);
  }

  entries() {
    return [...this.stepExecutorFactoryMap.entries()];
  }

  clone() {
    const registry = new StepExecutorRegistry();

    for (const [stepType, factory] of this.entries()) {
      registry.register(stepType, factory);
    }

    return registry;
  }
}
