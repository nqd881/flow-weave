import {
  IFlowDef,
  IFlowExecutionContext,
  IStepDef,
} from "../abstraction";
import { FlowDef, FlowOptions } from "./flow-def";
import {
  ForEachStepDefBuilder,
  IStepDefBuilder,
  ParallelForEachStepDefBuilder,
  ParallelStepDefBuilder,
  SwitchStepDefBuilder,
} from "./step-builders";
import { StepOptions, SwitchStepDef, TaskStepDef, WhileStepDef } from "./step-defs";
import { BranchAdapter, Condition, FlowFactory, Selector, Task } from "./types";

export class FlowDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> {
  protected id?: string;
  protected options?: FlowOptions<TContext>;
  protected steps: Array<
    IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>
  > = [];
  protected nextStepId?: string;

  constructor(
    protected readonly flowBuilderClient: TFlowBuilderClient,
    id?: string,
    options?: FlowOptions<TContext>,
  ) {
    this.id = id;
    this.options = options;
  }

  protected consumeNextStepId() {
    const id = this.nextStepId;
    this.nextStepId = undefined;
    return id;
  }

  protected addStep(
    step: IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>,
  ) {
    this.steps.push(step);
    return this;
  }

  step(id?: string) {
    this.nextStepId = id;
    return this;
  }

  task<TTask extends Task<TContext>>(
    task: TTask,
    options?: StepOptions<TContext>,
  ) {
    const step = new TaskStepDef<TContext, TTask>(
      task,
      this.consumeNextStepId(),
      options,
    );

    return this.addStep(step);
  }

  parallel(options?: StepOptions<TContext>) {
    const stepBuilder = new ParallelStepDefBuilder<
      TFlowBuilderClient,
      TContext,
      this
    >(this, this.flowBuilderClient, this.consumeNextStepId(), options);

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  while<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    condition: Condition<TContext>,
    iterationFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
    options?: StepOptions<TContext>,
  ) {
    iterationFlow =
      typeof iterationFlow === "function"
        ? iterationFlow(this.flowBuilderClient)
        : iterationFlow;

    const step = new WhileStepDef<TContext>(
      condition,
      iterationFlow,
      adapt,
      this.consumeNextStepId(),
      options,
    );

    return this.addStep(step);
  }

  if(
    condition: Condition<TContext>,
    trueCase: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    elseCase?: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    options?: StepOptions<TContext>,
  ) {
    const trueFlow =
      typeof trueCase === "function"
        ? trueCase(this.flowBuilderClient)
        : trueCase;
    const elseFlow =
      typeof elseCase === "function"
        ? elseCase(this.flowBuilderClient)
        : elseCase;

    const step = new SwitchStepDef<TContext, boolean>(
      condition,
      [
        {
          predicate: (value) => !!value,
          flow: trueFlow,
        },
      ],
      elseFlow ? { flow: elseFlow } : undefined,
      this.consumeNextStepId(),
      options,
    );

    this.addStep(step);

    return this;
  }

  switchOn<TValue>(
    selector: Selector<TContext, TValue>,
    options?: StepOptions<TContext>,
  ) {
    const stepBuilder = new SwitchStepDefBuilder<
      TFlowBuilderClient,
      TContext,
      TValue,
      this
    >(this, this.flowBuilderClient, selector, this.consumeNextStepId(), options);

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  forEach<TItem>(
    items: Selector<TContext, TItem[]>,
    options?: StepOptions<TContext>,
  ) {
    const stepBuilder = new ForEachStepDefBuilder(
      this,
      this.flowBuilderClient,
      items,
      this.consumeNextStepId(),
      options,
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  parallelForEach<TItem>(
    items: Selector<TContext, TItem[]>,
    options?: StepOptions<TContext>,
  ) {
    const stepBuilder = new ParallelForEachStepDefBuilder(
      this,
      this.flowBuilderClient,
      items,
      this.consumeNextStepId(),
      options,
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
    const steps = this.buildSteps();

    return new FlowDef<TContext>(steps, this.id, this.options);
  }
}
