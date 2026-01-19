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

export interface IFlowBuilderClient {
  newFlow<
    TContext extends IFlowExecutionContext = IFlowExecutionContext,
  >(): FlowDefBuilder<any, TContext>;
}

export class FlowDefBuilder<
  TClient extends IFlowBuilderClient = IFlowBuilderClient,
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> {
  protected steps: Array<
    IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>
  > = [];

  constructor(protected readonly client: TClient) {}

  addStep(step: IStepDef<TContext> | IStepDefBuilder<IStepDef<TContext>>) {
    this.steps.push(step);
    return this;
  }

  task<TTask extends Task<TContext>>(task: TTask) {
    const step = new TaskStepDef<TContext, TTask>(task);

    return this.addStep(step);
  }

  parallel() {
    const stepBuilder = new ParallelStepDefBuilder<TClient, TContext>(
      this,
      this.client,
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  while<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    condition: Condition<TContext>,
    provider: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ) {
    const body =
      typeof provider === "function" ? provider(this.client) : provider;

    const step = new WhileStepDef<TContext>(condition, body, adapt);

    return this.addStep(step);
  }

  if(
    condition: Condition<TContext>,
    trueCase: IFlowDef<TContext> | FlowFactory<TClient, TContext>,
    elseCase?: IFlowDef<TContext> | FlowFactory<TClient, TContext>,
  ) {
    const trueFlow =
      typeof trueCase === "function" ? trueCase(this.client) : trueCase;
    const elseFlow =
      typeof elseCase === "function" ? elseCase(this.client) : elseCase;

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
    const stepBuilder = new SwitchStepDefBuilder<TClient, TContext, TValue>(
      this,
      this.client,
      selector,
    );

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  forEach<TItem>(items: Selector<TContext, TItem[]>) {
    const stepBuilder = new ForEachStepDefBuilder(this, this.client, items);

    this.addStep(stepBuilder);

    return stepBuilder;
  }

  parallelForEach<TItem>(items: Selector<TContext, TItem[]>) {
    const stepBuilder = new ParallelForEachStepDefBuilder(
      this,
      this.client,
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

    return new FlowDef<TContext>(steps);
  }
}
