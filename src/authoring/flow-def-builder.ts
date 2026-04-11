import { IFlowDef, IFlowContext, IStepDef } from "../contracts";
import { v4 } from "uuid";
import { FlowDef, FlowDefMetadata } from "../flow";
import { FlowDefFactory } from "./flow-def-factory";
import {
  ForEachStepDefBuilder,
  ParallelForEachStepDefBuilder,
  ParallelStepDefBuilder,
  SwitchStepDefBuilder,
} from "./step-builders";
import { IStepDefBuilder } from "./step-builders/step-def-builder";
import { IStepDefMetadataBuilder } from "./step-builders/step-def-metadata-builder";
import {
  ChildFlowStepDef,
  DelayStepDef,
  StepDefMetadata,
  StepHook,
  StepHooks,
  SwitchStepDef,
  TaskStepDef,
  WhileStepDef,
} from "../flow/step-defs";
import {
  Condition,
  ContextAdapter,
  Selector,
  Task,
} from "../flow/types";

type StepDefDraft<TContext extends IFlowContext> = {
  id?: string;
  hooks?: StepHooks<TContext>;
  build: (metadata?: StepDefMetadata<TContext>) => IStepDef<TContext>;
};

type StepDefClass<
  TContext extends IFlowContext,
  TStep extends IStepDef<TContext> = IStepDef<TContext>,
> = new (...args: any[]) => TStep;

type StepDefClassArgs<
  TContext extends IFlowContext,
  TClass extends StepDefClass<TContext>,
> = ConstructorParameters<TClass> extends [
  ...infer TArgs,
  StepDefMetadata<TContext>?,
]
  ? TArgs
  : ConstructorParameters<TClass>;

export class FlowDefBuilder<
  TWeaver,
  TContext extends IFlowContext = IFlowContext,
> implements IStepDefMetadataBuilder<TContext> {
  protected id?: string;
  protected metadata?: FlowDefMetadata<TContext>;
  protected steps: Array<
    IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>
  > = [];
  protected pendingStepId?: string;
  protected stepDraft?: StepDefDraft<TContext>;

  constructor(
    protected readonly weaver: TWeaver,
    id?: string,
    metadata?: FlowDefMetadata<TContext>,
  ) {
    this.id = id;
    this.metadata = metadata;
  }

  protected consumePendingStepId() {
    const id = this.pendingStepId;
    this.pendingStepId = undefined;
    return id;
  }

  protected addStep(
    step: IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>,
  ) {
    this.steps.push(step);
    return this;
  }

  protected openStepDraft(
    build: (metadata?: StepDefMetadata<TContext>) => IStepDef<TContext>,
    id = this.consumePendingStepId(),
  ) {
    this.stepDraft = { id, build };
    return this;
  }

  protected flushStepDraft() {
    if (!this.stepDraft) return;

    const step = this.stepDraft.build({
      id: this.stepDraft.id,
      hooks: this.stepDraft.hooks,
    });

    this.stepDraft = undefined;
    this.steps.push(step);
  }

  protected ensureStepDraft() {
    if (!this.stepDraft) {
      throw new Error(
        "hooks() can only be used after declaring a simple step.",
      );
    }

    return this.stepDraft;
  }

  protected isStepDefInstance(value: unknown): value is IStepDef<TContext> {
    return typeof value === "object" && value !== null && "id" in value;
  }

  protected isStepDefClass<TStep extends IStepDef<TContext>>(
    value: unknown,
  ): value is StepDefClass<TContext, TStep> {
    return typeof value === "function";
  }

  step(): this;
  step(id: string): this;
  step(stepDef: IStepDef<TContext>): this;
  step<TClass extends StepDefClass<TContext>>(
    stepClass: TClass,
    ...args: StepDefClassArgs<TContext, TClass>
  ): this;
  step<TClass extends StepDefClass<TContext>>(
    id: string,
    stepClass: TClass,
    ...args: StepDefClassArgs<TContext, TClass>
  ): this;
  step(
    idOrStepOrClass?: string | IStepDef<TContext> | StepDefClass<TContext>,
    stepOrClassOrArg?: IStepDef<TContext> | StepDefClass<TContext> | unknown,
    ...args: unknown[]
  ) {
    this.flushStepDraft();

    if (typeof idOrStepOrClass === "undefined") {
      this.pendingStepId = undefined;
      return this;
    }

    if (typeof idOrStepOrClass === "string") {
      if (typeof stepOrClassOrArg === "undefined") {
        this.pendingStepId = idOrStepOrClass;
        return this;
      }

      if (this.isStepDefInstance(stepOrClassOrArg)) {
        throw new Error(
          "step(id, stepDef) is not supported. Add the step instance as-is or use step(id, StepClass, ...args).",
        );
      }

      if (this.isStepDefClass(stepOrClassOrArg)) {
        this.pendingStepId = undefined;

        return this.openStepDraft(
          (metadata) => new stepOrClassOrArg(...args, metadata),
          idOrStepOrClass,
        );
      }

      throw new Error("Invalid step() arguments.");
    }

    if (this.isStepDefInstance(idOrStepOrClass)) {
      this.pendingStepId = undefined;
      return this.addStep(idOrStepOrClass);
    }

    if (this.isStepDefClass(idOrStepOrClass)) {
      const stepArgs =
        typeof stepOrClassOrArg === "undefined"
          ? args
          : [stepOrClassOrArg, ...args];

      return this.openStepDraft(
        (metadata) => new idOrStepOrClass(...stepArgs, metadata),
      );
    }

    throw new Error("Invalid step() arguments.");
  }

  hooks(hooks: StepHooks<TContext>) {
    this.ensureStepDraft().hooks = hooks;
    return this;
  }

  preHooks(...hooks: StepHook<TContext>[]) {
    const stepDraft = this.ensureStepDraft();

    stepDraft.hooks = {
      ...stepDraft.hooks,
      pre: [...(stepDraft.hooks?.pre ?? []), ...hooks],
    };

    return this;
  }

  postHooks(...hooks: StepHook<TContext>[]) {
    const stepDraft = this.ensureStepDraft();

    stepDraft.hooks = {
      ...stepDraft.hooks,
      post: [...(stepDraft.hooks?.post ?? []), ...hooks],
    };

    return this;
  }

  task<TTask extends Task<TContext>>(task: TTask) {
    this.flushStepDraft();

    return this.openStepDraft((options) => new TaskStepDef<TContext, TTask>(task, options));
  }

  delay(durationMs: number | Selector<TContext, number>) {
    this.flushStepDraft();

    const durationSelector: Selector<TContext, number> =
      typeof durationMs === "number" ? () => durationMs : durationMs;

    return this.openStepDraft((metadata) =>
      new DelayStepDef<TContext>(durationSelector, metadata),
    );
  }

  childFlow<TChildContext extends IFlowContext = IFlowContext>(
    childFlow:
      | IFlowDef<TChildContext>
      | FlowDefFactory<TWeaver, TChildContext>,
    adapt?: ContextAdapter<TContext, TChildContext>,
  ) {
    this.flushStepDraft();

    childFlow = typeof childFlow === "function" ? childFlow(this.weaver) : childFlow;

    return this.openStepDraft((metadata) =>
      new ChildFlowStepDef<TContext, TChildContext>(
        childFlow,
        adapt,
        metadata,
      ),
    );
  }

  parallel() {
    this.flushStepDraft();

    const stepBuilder = new ParallelStepDefBuilder<TWeaver, TContext, this>(
      this,
      this.weaver,
      this.consumePendingStepId(),
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  while<TBranchContext extends IFlowContext = IFlowContext>(
    condition: Condition<TContext>,
    iterationFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext>,
  ) {
    this.flushStepDraft();

    iterationFlow =
      typeof iterationFlow === "function"
        ? iterationFlow(this.weaver)
        : iterationFlow;

    return this.openStepDraft((options) =>
      new WhileStepDef<TContext>(condition, iterationFlow, adapt, options),
    );
  }

  if(
    condition: Condition<TContext>,
    trueCase: IFlowDef<TContext> | FlowDefFactory<TWeaver, TContext>,
    elseCase?: IFlowDef<TContext> | FlowDefFactory<TWeaver, TContext>,
  ) {
    this.flushStepDraft();

    const trueFlow =
      typeof trueCase === "function" ? trueCase(this.weaver) : trueCase;
    const elseFlow =
      typeof elseCase === "function" ? elseCase(this.weaver) : elseCase;

    return this.openStepDraft((options) =>
      new SwitchStepDef<TContext, boolean>(
        condition,
        [
          {
            predicate: (value) => !!value,
            flow: trueFlow,
          },
        ],
        elseFlow ? { flow: elseFlow } : undefined,
        options,
      ),
    );
  }

  switchOn<TValue>(selector: Selector<TContext, TValue>) {
    this.flushStepDraft();

    const stepBuilder = new SwitchStepDefBuilder<
      TWeaver,
      TContext,
      TValue,
      this
    >(this, this.weaver, selector, this.consumePendingStepId());

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  forEach<TItem>(items: Selector<TContext, TItem[]>) {
    this.flushStepDraft();

    const stepBuilder = new ForEachStepDefBuilder(
      this,
      this.weaver,
      items,
      this.consumePendingStepId(),
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  parallelForEach<TItem>(items: Selector<TContext, TItem[]>) {
    this.flushStepDraft();

    const stepBuilder = new ParallelForEachStepDefBuilder(
      this,
      this.weaver,
      items,
      this.consumePendingStepId(),
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  protected buildSteps(): IStepDef<TContext>[] {
    return this.steps.map((step) =>
      "build" in step ? step.build() : step,
    ) as IStepDef<TContext>[];
  }

  build(): IFlowDef<TContext> {
    this.flushStepDraft();

    const steps = this.buildSteps();
    const flowId = this.id ?? v4();

    return new FlowDef<TContext>(flowId, steps, this.metadata);
  }
}
