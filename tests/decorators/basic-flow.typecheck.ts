import assert from "assert/strict";
import { test } from "vitest";
import {
  BreakLoopStepDef,
  DelayStepDef,
  IFlowDef,
  StepDef,
  StepDefMetadata,
  TaskStepDef,
} from "../../src";
import {
  Break,
  Delay,
  Flow,
  StepId,
  Task,
  createMethodStepDecorator,
  createStepDecorator,
  createSubDecorator,
} from "../../src/authoring/decorator";

class LabelStepDef extends StepDef<{ events: string[] }> {
  constructor(
    public readonly label: string,
    metadata?: StepDefMetadata<{ events: string[] }>,
  ) {
    super(metadata);
  }
}

class HandlerStepDef extends StepDef<{ events: string[] }> {
  constructor(
    public readonly handler: (context: { events: string[] }) => void,
    metadata?: StepDefMetadata<{ events: string[] }>,
  ) {
    super(metadata);
  }
}

class GroupStepDef extends StepDef {
  constructor(
    public readonly labels: string[],
    metadata?: StepDefMetadata,
  ) {
    super(metadata);
  }
}

const Label = createStepDecorator(
  (_pending, label: string) => (metadata) => new LabelStepDef(label, metadata),
  "Label",
);

const InlineHandler = createMethodStepDecorator(
  (_pending, method) => (metadata) =>
    new HandlerStepDef(method as HandlerStepDef["handler"], metadata),
  "InlineHandler",
);

const GroupLabel = createSubDecorator(
  "group-labels",
  (label: string) => label,
  "GroupLabel",
);

const Group = createStepDecorator(
  (pending) => (metadata) =>
    new GroupStepDef(
      [...((pending["group-labels"] as string[] | undefined) ?? [])].reverse(),
      metadata,
    ),
  "Group",
);

function testBasicDecoratedFlowCompilesInSourceOrder() {
  @Flow<{ events: string[] }>("basic-flow")
  class BasicFlow {
    declare static readonly flowDef: IFlowDef<{ events: string[] }>;

    @Task()
    static first(ctx: { events: string[] }) {
      ctx.events.push("first");
    }

    @Delay(25)
    @StepId("delay-step")
    static wait: void;

    @Break()
    static stop: void;
  }

  const flow = BasicFlow.flowDef;

  assert.equal(flow.id, "basic-flow");
  assert.equal(flow.steps.length, 3);
  assert.ok(flow.steps[0] instanceof TaskStepDef);
  assert.ok(flow.steps[1] instanceof DelayStepDef);
  assert.ok(flow.steps[2] instanceof BreakLoopStepDef);
  assert.equal(flow.steps[1]?.id, "delay-step");
  assert.equal(BasicFlow.flowDef, flow);
}

function testCustomStepDecoratorFactoriesSupportMetadata() {
  @Flow<{ events: string[] }>("custom-field-and-method")
  class CustomFlow {
    declare static readonly flowDef: IFlowDef<{ events: string[] }>;

    @Label("label-step")
    @StepId("custom-step")
    static labeled: void;

    @InlineHandler()
    static inline(ctx: { events: string[] }) {
      ctx.events.push("inline");
    }
  }

  const labeledStep = CustomFlow.flowDef.steps[0] as LabelStepDef;
  const inlineStep = CustomFlow.flowDef.steps[1] as HandlerStepDef;
  const context = { events: [] as string[] };

  inlineStep.handler(context);

  assert.ok(labeledStep instanceof LabelStepDef);
  assert.equal(labeledStep.id, "custom-step");
  assert.equal(labeledStep.label, "label-step");
  assert.deepEqual(context.events, ["inline"]);
}

function testCustomSubDecoratorCanAccumulatePendingData() {
  @Flow("custom-sub-decorator")
  class CustomGroupFlow {
    declare static readonly flowDef: IFlowDef;

    @Group()
    @GroupLabel("first")
    @GroupLabel("second")
    static grouped: void;
  }

  const step = CustomGroupFlow.flowDef.steps[0] as GroupStepDef;

  assert.ok(step instanceof GroupStepDef);
  assert.deepEqual(step.labels, ["first", "second"]);
}

test(
  "basic decorator flow compiles in source order",
  testBasicDecoratedFlowCompilesInSourceOrder,
);
test(
  "custom decorator factories support metadata",
  testCustomStepDecoratorFactoriesSupportMetadata,
);
test(
  "custom sub-decorator accumulates pending data",
  testCustomSubDecoratorCanAccumulatePendingData,
);
