import assert from "assert/strict";
import { test } from "vitest";
import { FlowExecutionOutcomeKind, ParallelStepStrategy } from "../../src";
import { ParallelStepDef, StepDef, StepDefMetadata } from "../../src/flow";
import { createCoreApp, createSagaApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";

function testParallelBuilderStrategies() {
  const weaver = createCoreApp().weaver();

  const baseFlow = weaver
    .flow()
    .task(() => undefined)
    .build();

  const flowFirst = weaver
    .flow()
    .parallel()
    .branch(baseFlow)
    .firstSettled()
    .join()
    .build();

  const firstParallel = flowFirst.steps[0] as ParallelStepDef;
  assert.equal(firstParallel.strategy, ParallelStepStrategy.FirstSettled);

  const flowDefault = weaver
    .flow()
    .parallel()
    .branch(baseFlow)
    .join()
    .build();

  const defaultParallel = flowDefault.steps[0] as ParallelStepDef;
  assert.equal(defaultParallel.strategy, ParallelStepStrategy.AllSettled);

  const flowFailFast = weaver
    .flow()
    .parallel()
    .branch(baseFlow)
    .failFast()
    .join()
    .build();

  const failFastParallel = flowFailFast.steps[0] as ParallelStepDef;
  assert.equal(failFastParallel.strategy, ParallelStepStrategy.FailFast);

  const flowFirstCompleted = weaver
    .flow()
    .parallel()
    .branch(baseFlow)
    .firstCompleted()
    .join()
    .build();

  const firstCompletedParallel = flowFirstCompleted.steps[0] as ParallelStepDef;
  assert.equal(firstCompletedParallel.strategy, ParallelStepStrategy.FirstCompleted);
}

function testForEachBuildersRequireRunBeforeBuild() {
  const builder = createCoreApp().weaver();

  assert.throws(() => {
    builder
      .flow<{ items: number[] }>()
      .forEach((ctx) => ctx.items)
      .build();
  }, /ForEach step requires run\(\.\.\.\) before build\./);

  assert.throws(() => {
    builder
      .flow<{ items: number[] }>()
      .parallelForEach((ctx) => ctx.items)
      .build();
  }, /ParallelForEach step requires run\(\.\.\.\) before build\./);
}

async function testWhileLoopExecutesIterations() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let iterations = 0;

  const loopFlow = builder
    .flow<{ count: number }>()
    .task((ctx) => {
      iterations += 1;
      ctx.count += 1;
    })
    .build();

  const flow = builder
    .flow<{ count: number }>()
    .while((ctx) => ctx.count < 3, loopFlow)
    .build();

  await runtime.createFlowExecution(flow, { count: 0 }).start();

  assert.equal(iterations, 3, "loopFlow should run three times");
}

async function testTaskHooksRunInOrder() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const flow = builder
    .flow<{ value: number }>()
    .step("hooked-task")
    .task((ctx) => {
      events.push(`task:${ctx.value}`);
    })
    .hooks({
      pre: [
        (_ctx, { status, stepId }) => events.push(`pre:${status}:${stepId}`),
      ],
      post: [
        (_ctx, { status, stepId, outcome }) =>
          events.push(`post:${status}:${outcome?.kind}:${stepId}`),
      ],
    })
    .build();

  await runtime.createFlowExecution(flow, { value: 42 }).start();

  assert.deepEqual(events, [
    "pre:running:hooked-task",
    "task:42",
    "post:running:completed:hooked-task",
  ]);
}

function testStepFlushesCurrentDraftBeforePreparingNextId() {
  const builder = createCoreApp().weaver();

  const flow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("first");
    })
    .hooks({
      pre: [(_ctx, { stepId }) => stepId],
    })
    .step("second-step")
    .task((ctx) => {
      ctx.events.push("second");
    })
    .build();

  const firstStep = flow.steps[0] as { hooks?: { pre?: unknown[] } } | undefined;

  assert.notEqual(flow.steps[0]?.id, "second-step");
  assert.equal(flow.steps[1]?.id, "second-step");
  assert.equal(firstStep?.hooks?.pre?.length, 1);
}

function testHooksCannotBeUsedAfterStepUntilNextStepExists() {
  const builder = createCoreApp().weaver();

  assert.throws(
    () => {
      builder
        .flow<{ value: number }>()
        .task((ctx) => {
          ctx.value += 1;
        })
        .step("next-step")
        .hooks({
          pre: [() => undefined],
        });
    },
    /Step metadata methods can only be used after declaring a step\./,
  );
}

function testStepClassConsumesPendingIdAndSupportsHooks() {
  class CustomLabelStepDef extends StepDef<{ events: string[] }> {
    constructor(
      public readonly label: string,
      metadata?: StepDefMetadata<{ events: string[] }>,
    ) {
      super(metadata);
    }
  }

  const builder = createCoreApp().weaver();

  const flow = builder
    .flow<{ events: string[] }>()
    .step("custom-step")
    .step(CustomLabelStepDef, "custom-label")
    .hooks({
      pre: [() => undefined],
    })
    .step("task-step")
    .task((ctx) => {
      ctx.events.push("task");
    })
    .build();

  const customStep = flow.steps[0] as CustomLabelStepDef & {
    hooks?: { pre?: unknown[] };
  };

  assert.ok(customStep instanceof CustomLabelStepDef);
  assert.equal(customStep.id, "custom-step");
  assert.equal(customStep.label, "custom-label");
  assert.equal(customStep.hooks?.pre?.length, 1);
  assert.equal(flow.steps[1]?.id, "task-step");
}

function testStepInstanceIgnoresPendingIdAndClearsIt() {
  class CustomLabelStepDef extends StepDef<{ events: string[] }> {
    constructor(
      public readonly label: string,
      metadata?: StepDefMetadata<{ events: string[] }>,
    ) {
      super(metadata);
    }
  }

  const builder = createCoreApp().weaver();
  const existingStep = new CustomLabelStepDef("existing", {
    id: "existing-step",
  });

  const flow = builder
    .flow<{ events: string[] }>()
    .step("ignored-pending-id")
    .step(existingStep)
    .step("task-step")
    .task((ctx) => {
      ctx.events.push("task");
    })
    .build();

  assert.equal(flow.steps[0]?.id, "existing-step");
  assert.equal(flow.steps[1]?.id, "task-step");
}

function testStepWithIdAndStepInstanceIsRejected() {
  class CustomLabelStepDef extends StepDef {
    constructor(metadata?: StepDefMetadata) {
      super(metadata);
    }
  }

  const builder = createCoreApp().weaver();
  const existingStep = new CustomLabelStepDef();

  assert.throws(
    () => {
      builder.flow().step("invalid", existingStep as any);
    },
    /step\(id, stepDef\) is not supported/,
  );
}

function testSagaBuilderPreservesProvidedId() {
  const builder = createSagaApp().weaver();

  const saga = builder
    .saga("my-saga-id")
    .task(() => undefined)
    .build();

  assert.equal(saga.id, "my-saga-id");
}

test("parallel builder strategies are preserved", testParallelBuilderStrategies);
test("forEach builders require run before build", testForEachBuildersRequireRunBeforeBuild);
test("while loop executes iterations", testWhileLoopExecutesIterations);
test("task hooks run in order", testTaskHooksRunInOrder);
test("step flushes current draft before preparing next id", testStepFlushesCurrentDraftBeforePreparingNextId);
test("hooks cannot be used after step until next step exists", testHooksCannotBeUsedAfterStepUntilNextStepExists);
test("step class consumes pending id and supports hooks", testStepClassConsumesPendingIdAndSupportsHooks);
test("step instance ignores pending id and clears it", testStepInstanceIgnoresPendingIdAndClearsIt);
test("step(id, stepDef) is rejected", testStepWithIdAndStepInstanceIsRejected);
test("saga builder preserves provided id", testSagaBuilderPreservesProvidedId);
