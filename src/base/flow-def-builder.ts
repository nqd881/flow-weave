import { IFlowDef, IFlowExecutionContext, IStepDef } from "../abstraction";
import { FlowDef } from "./flow-def";
import {
  ForEachStepDefBuilder,
  IStepDefBuilder,
  ParallelForEachStepDefBuilder,
  ParallelStepDefBuilder,
  SwitchStepDefBuilder,
} from "./step-builders";
import { SwitchStepDef, TaskStepDef, WhileStepDef } from "./step-defs";
import { BranchAdapter, Condition, FlowFactory, Selector, Task } from "./types";

export class FlowDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> {
  protected id?: string;
  protected steps: Array<
    IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>
  > = [];

  constructor(
    protected readonly builderClient: TBuilderClient,
    id?: string,
  ) {
    this.id = id;
  }

  addStep(step: IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>) {
    this.steps.push(step);
    return this;
  }

  task<TTask extends Task<TContext>>(task: TTask) {
    const step = new TaskStepDef<TContext, TTask>(task);

    return this.addStep(step);
  }

  parallel() {
    const stepBuilder = new ParallelStepDefBuilder<TBuilderClient, TContext>(
      this,
      this.builderClient,
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  while<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    condition: Condition<TContext>,
    loopFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ) {
    loopFlow =
      typeof loopFlow === "function" ? loopFlow(this.builderClient) : loopFlow;

    const step = new WhileStepDef<TContext>(condition, loopFlow, adapt);

    return this.addStep(step);
  }

  if(
    condition: Condition<TContext>,
    trueCase: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
    elseCase?: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
  ) {
    const trueFlow =
      typeof trueCase === "function" ? trueCase(this.builderClient) : trueCase;
    const elseFlow =
      typeof elseCase === "function" ? elseCase(this.builderClient) : elseCase;

    const step = new SwitchStepDef<TContext, boolean>(
      condition,
      [
        {
          predicate: (value) => !!value,
          flow: trueFlow,
        },
      ],
      elseFlow ? { flow: elseFlow } : undefined,
    );

    this.addStep(step);

    return this;
  }

  switchOn<TValue>(selector: Selector<TContext, TValue>) {
    const stepBuilder = new SwitchStepDefBuilder<
      TBuilderClient,
      TContext,
      TValue
    >(this, this.builderClient, selector);

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  forEach<TItem>(items: Selector<TContext, TItem[]>) {
    const stepBuilder = new ForEachStepDefBuilder(
      this,
      this.builderClient,
      items,
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  parallelForEach<TItem>(items: Selector<TContext, TItem[]>) {
    const stepBuilder = new ParallelForEachStepDefBuilder(
      this,
      this.builderClient,
      items,
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

    return new FlowDef<TContext>(steps, this.id);
  }
}
