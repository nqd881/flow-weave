/// <reference types="node" />
import assert from "assert/strict";
import {
  BreakLoopSignal,
  FlowExecutionOutcomeKind,
  FlowWeave,
  FlowExecutionStatus,
  FlowPlugin,
  ParallelStepStrategy,
  IFlowRuntime,
  IFlowExecutionFactory,
  IFlowExecution,
  IFlowDef,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  CompensatorStrategy,
  FlowExecutionFactoryRegistry,
  StepExecutionFailedOutcome,
  StepExecutionRecoveredOutcome,
  StepExecutionStatus,
  WeaverBuilder,
  Runtime,
  RuntimeBuilder,
  registerBuiltInRuntimeComponents,
  SagaExecution,
  SagaExecutionFactory,
  SagaStatus,
  StopSignal,
  StepExecutorRegistry,
  sagaPlugin,
} from "../src";
import {
  ChildFlowStepDef,
  FlowDef,
  FlowExecutionFactory,
  FlowExecution,
  FlowExecutor,
  DelayStepDef,
  ParallelStepDef,
  StepDef,
  StepDefMetadata,
  TaskStepDef,
} from "../src/flow";

function asSagaExecution<T extends SagaExecution>(execution: unknown): T {
  return execution as T;
}

function createCoreApp() {
  return FlowWeave.create().build();
}

function createSagaApp() {
  return FlowWeave.create().use(sagaPlugin).build();
}

function assertFlowOutcome(
  execution: IFlowExecution,
  expectedOutcome: FlowExecutionOutcomeKind,
) {
  assert.equal(execution.getStatus(), FlowExecutionStatus.Finished);
  assert.equal(execution.getOutcome()?.kind, expectedOutcome);
}

function testFlowWeaveCoreAppDoesNotExposeSaga() {
  const weaver = createCoreApp().weaver() as any;

  assert.equal(typeof weaver.saga, "undefined");
}

function testFlowWeaveSagaPluginExposesSaga() {
  const weaver = createSagaApp().weaver() as any;

  assert.equal(typeof weaver.saga, "function");
}

function testWeaverBuilderSupportsPlugins() {
  const weaver = new WeaverBuilder().use(sagaPlugin).build() as any;

  assert.equal(typeof weaver.flow, "function");
  assert.equal(typeof weaver.saga, "function");
}

function testFlowWeavePluginDependencies() {
  const dependentPlugin: FlowPlugin = {
    id: "dependent",
    dependsOn: ["base"],
    installWeaver(builder: any) {
      return builder;
    },
    installRuntime() {},
  };

  assert.throws(
    () => {
      FlowWeave.create().use(dependentPlugin);
    },
    /depends on 'base'/,
  );

  assert.throws(
    () => {
      new WeaverBuilder().use(dependentPlugin);
    },
    /depends on 'base'/,
  );
}

async function testStopBeforeStart() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const flow = builder
    .flow()
    .task(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    })
    .build();

  const execution = runtime.createFlowExecution(flow, {} as any);

  execution.requestStop();

  try {
    await execution.start();
    assert.fail("start() should reject with StopSignal");
  } catch (err) {
    assert.ok(err instanceof StopSignal, "expected StopSignal");
  }

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
}

async function testFlowOnFinishedObserverDoesNotOverrideFailure() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();
  const mainError = new Error("flow-main-error");

  const flow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("task");
      throw mainError;
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  execution.onFinished(() => {
    execution.context.events.push("observer");
    throw new Error("flow-observer-error");
  });

  await assert.rejects(async () => {
    await execution.start();
  }, (error: unknown) => error === mainError);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, ["task", "observer"]);
}

async function testFlowOnFinishedObserverDoesNotFailSuccess() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const flow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("task");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  execution.onFinished(() => {
    execution.context.events.push("observer");
    throw new Error("flow-observer-error");
  });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["task", "observer"]);
}

function testFlowStopHandlersAreBestEffort() {
  const execution = Runtime.default().createFlowExecution(
    new FlowDef("stop-handler-flow", []),
    {},
  );
  const events: string[] = [];

  execution.onStopRequested(() => {
    events.push("first");
    throw new Error("stop-handler-error");
  });
  execution.onStopRequested(() => {
    events.push("second");
  });

  assert.doesNotThrow(() => {
    execution.requestStop();
  });

  assert.equal(execution.isStopRequested(), true);
  assert.deepEqual(events, ["first", "second"]);
}

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
    /Step metadata methods can only be used after declaring a simple step\./,
  );
}

async function testDelayStepCompletesAndUsesSelector() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const flow = builder
    .flow<{ delayMs: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push("before-delay");
    })
    .delay((ctx) => ctx.delayMs)
    .task((ctx) => {
      ctx.events.push("after-delay");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, {
    delayMs: 0,
    events: [],
  });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["before-delay", "after-delay"]);
}

async function testDelayStepRejectsInvalidDuration() {
  const runtime = Runtime.default();
  const execution = runtime.createFlowExecution(
    new FlowDef<{ delayMs: number }>("invalid-delay", [
      new DelayStepDef((ctx) => ctx.delayMs),
    ]),
    { delayMs: -1 },
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /Delay duration must be a non-negative finite number\./);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
}

async function testDelayStepStopsWhileWaiting() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const flow = builder.flow().delay(50).build();
  const execution = runtime.createFlowExecution(flow, {});

  setTimeout(() => {
    execution.requestStop();
  }, 10);

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
}

async function testChildFlowRunsSequentiallyWithAdapt() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const childFlow = builder
    .flow<{ value: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`child:${ctx.value}`);
    })
    .build();

  const flow = builder
    .flow<{ amount: number; events: string[] }>()
    .childFlow(childFlow, (ctx) => ({ value: ctx.amount, events: ctx.events }))
    .task((ctx) => {
      ctx.events.push("after-child");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { amount: 3, events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["child:3", "after-child"]);
}

async function testChildFlowPropagatesStopToChildFlow() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const childFlow = builder
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("child-completed");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .childFlow(childFlow)
    .task((ctx) => {
      ctx.events.push("parent-after-child");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  setTimeout(() => {
    execution.requestStop();
  }, 10);

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

async function testBreakInsideIfBreaksNearestWhileLoop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const breakFlow = builder.flow<{ count: number; events: string[] }>().break().build();
  const iterationFlow = builder
    .flow<{ count: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`iter:${ctx.count}`);
    })
    .if((ctx) => ctx.count === 2, breakFlow)
    .task((ctx) => {
      ctx.count += 1;
      ctx.events.push(`after:${ctx.count}`);
    })
    .build();
  const flow = builder
    .flow<{ count: number; events: string[] }>()
    .while((ctx) => ctx.count < 4, iterationFlow)
    .task((ctx) => {
      ctx.events.push("done");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { count: 0, events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(execution.context.count, 2);
  assert.deepEqual(execution.context.events, [
    "iter:0",
    "after:1",
    "iter:1",
    "after:2",
    "iter:2",
    "done",
  ]);
}

async function testBreakInsideChildFlowBreaksNearestForEachLoop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const breakFlow = builder.flow<{ item: number; events: string[] }>().break().build();
  const nestedBreakCheck = builder
    .flow<{ item: number; events: string[] }>()
    .if((ctx) => ctx.item === 2, breakFlow)
    .build();
  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);
    })
    .childFlow(nestedBreakCheck)
    .task((ctx) => {
      ctx.events.push(`after:${ctx.item}`);
    })
    .build();
  const flow = builder
    .flow<{ events: string[] }>()
    .forEach(() => [1, 2, 3])
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .task((ctx) => {
      ctx.events.push("done");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, [
    "item:1",
    "after:1",
    "item:2",
    "done",
  ]);
}

async function testBreakOutsideLoopFailsClearly() {
  const runtime = Runtime.default();
  const builder = createCoreApp().weaver();
  const flow = builder.flow().break().build();
  const execution = runtime.createFlowExecution(flow, {});

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof BreakLoopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
}

async function testBreakInsideParallelFailsClearly() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const breakBranch = builder.flow<{ events: string[] }>().break().build();
  const siblingBranch = builder
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("sibling");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .while(
      () => true,
      (nestedBuilder) =>
        nestedBuilder
          .flow<{ events: string[] }>()
          .parallel()
          .branch(breakBranch)
          .branch(siblingBranch)
          .firstSettled()
          .join()
          .build(),
    )
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await assert.rejects(async () => {
    await execution.start();
  }, /break\(\) is not supported inside parallel or parallelForEach branches\./);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, []);
}

async function testBreakInsideParallelForEachFailsClearly() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .if(
      (ctx) => ctx.item === 1,
      (nestedBuilder) => nestedBuilder.flow<{ item: number; events: string[] }>().break().build(),
    )
    .delay((ctx) => (ctx.item === 2 ? 50 : 0))
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallelForEach(() => [1, 2])
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .firstSettled()
    .join()
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await assert.rejects(async () => {
    await execution.start();
  }, /break\(\) is not supported inside parallel or parallelForEach branches\./);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, []);
}

async function testTryCatchCompletesWithoutCatchWhenTrySucceeds() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const tryFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("try");
    })
    .build();
  const catchFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("catch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .try(tryFlow)
    .catch(catchFlow)
    .end()
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["try", "after"]);
}

async function testTryCatchCompletesAndCatchReceivesError() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();
  const statuses: StepExecutionStatus[] = [];

  const tryFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("try");
      throw new Error("boom");
    })
    .build();
  const catchFlow = builder
    .flow<{ message: string; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`catch:${ctx.message}`);
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .try(tryFlow)
    .postHooks((_ctx, info) => {
      statuses.push(info.status);
    })
    .catch(catchFlow, (ctx, error) => ({
      message: (error as Error).message,
      events: ctx.events,
    }))
    .end()
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["try", "catch:boom", "after"]);
  assert.deepEqual(statuses, [StepExecutionStatus.Running]);
}

async function testTryCatchStopBypassesCatch() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const tryFlow = builder.flow<{ events: string[] }>().delay(50).build();
  const catchFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("catch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .try(tryFlow)
    .catch(catchFlow)
    .end()
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  setTimeout(() => {
    execution.requestStop();
  }, 10);

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

async function testTryCatchCatchFailureFailsStep() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const tryFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("try");
      throw new Error("try-fail");
    })
    .build();
  const catchFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("catch");
      throw new Error("catch-fail");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .try(tryFlow)
    .catch(catchFlow)
    .end()
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await assert.rejects(async () => {
    await execution.start();
  }, /catch-fail/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, ["try", "catch"]);
}

async function testTryCatchRetryRerunsWholeBlock() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const tryFlow = builder
    .flow<{ attempt: number; events: string[] }>()
    .task((ctx) => {
      ctx.attempt += 1;
      ctx.events.push(`try:${ctx.attempt}`);
      throw new Error("try-fail");
    })
    .build();
  const catchFlow = builder
    .flow<{ attempt: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`catch:${ctx.attempt}`);

      if (ctx.attempt === 1) {
        throw new Error("catch-fail");
      }
    })
    .build();

  const flow = builder
    .flow<{ attempt: number; events: string[] }>()
    .try(tryFlow)
    .retry({ maxAttempts: 2 })
    .catch(catchFlow)
    .end()
    .build();
  const execution = runtime.createFlowExecution(flow, { attempt: 0, events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(execution.context.attempt, 2);
  assert.deepEqual(execution.context.events, [
    "try:1",
    "catch:1",
    "try:2",
    "catch:2",
  ]);
}

async function testStepRetrySucceedsAfterFailures() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("retry-success", [
      new TaskStepDef(
        (ctx: { events: string[] }) => {
          attempts += 1;
          ctx.events.push(`attempt:${attempts}`);

          if (attempts < 3) {
            throw new Error("retry-me");
          }
        },
        {
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    { events: [] },
  );

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(attempts, 3);
  assert.deepEqual(execution.context.events, [
    "attempt:1",
    "attempt:2",
    "attempt:3",
  ]);
}

async function testStepRetryFailsAfterExhaustion() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-fail", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("still-failing");
        },
        {
          retry: { maxAttempts: 2 },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /still-failing/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.equal(attempts, 2);
}

async function testStepRetryCanStopEarlyViaShouldRetry() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-should-stop-early", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("do-not-retry");
        },
        {
          retry: {
            maxAttempts: 5,
            shouldRetry: () => false,
          },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /do-not-retry/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.equal(attempts, 1);
}

async function testStepRetryStopsDuringBackoff() {
  const runtime = Runtime.default();

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-stop-backoff", [
      new TaskStepDef(
        () => {
          throw new Error("retry-stop");
        },
        {
          retry: {
            maxAttempts: 3,
            initialDelayMs: 50,
          },
        },
      ),
    ]),
    {},
  );

  setTimeout(() => {
    execution.requestStop();
  }, 10);

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
}

async function testStopSignalIsNotRetried() {
  class StoppingStepDef extends StepDef {
    constructor() {
      super({
        id: "stopping-step",
        retry: { maxAttempts: 3 },
      });
    }
  }

  let attempts = 0;

  class StoppingStepExecutor implements IStepExecutor<StoppingStepDef> {
    async execute() {
      attempts += 1;
      throw new StopSignal();
    }
  }

  const runtime = new RuntimeBuilder()
    .withBuiltIns()
    .withStepExecutor(StoppingStepDef, () => new StoppingStepExecutor())
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef("stopping-step-flow", [new StoppingStepDef()]),
    {},
  );

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.equal(attempts, 1);
}

async function testStepRecoverRunsAfterRetriesAreExhausted() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("retry-recover", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("recover-me");
        },
        {
          retry: { maxAttempts: 2 },
          recover: (error, ctx) => {
            ctx.events.push(`recovered:${(error as Error).message}`);
          },
        },
      ),
      new TaskStepDef((ctx: { events: string[] }) => {
        ctx.events.push("after-recover");
      }),
    ]),
    { events: [] },
  );

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(attempts, 2);
  assert.deepEqual(execution.context.events, [
    "recovered:recover-me",
    "after-recover",
  ]);
}

async function testPostHooksObserveRecoveredFinalStatus() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-recover-hooks", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error(`attempt-${attempts}`);
        },
        {
          hooks: {
            post: [(_ctx, info) => {
              assert.ok(info.outcome instanceof StepExecutionRecoveredOutcome);
              events.push(
                `${info.status}:${info.outcome.kind}:${(info.outcome.cause as Error).message}`,
              );
            }],
          },
          retry: { maxAttempts: 2 },
          recover: () => undefined,
        },
      ),
    ]),
    {},
  );

  await execution.start();

  assert.equal(attempts, 2);
  assert.deepEqual(events, ["running:recovered:attempt-2"]);
}

async function testRecoverDoesNotInterceptStopRequests() {
  class StoppingRecoverableStepDef extends StepDef {
    constructor() {
      super({
        id: "stopping-recoverable-step",
        retry: { maxAttempts: 3 },
        recover: () => {
          throw new Error("recover-should-not-run");
        },
      });
    }
  }

  let attempts = 0;

  class StoppingRecoverableStepExecutor
    implements IStepExecutor<StoppingRecoverableStepDef>
  {
    async execute() {
      attempts += 1;
      throw new StopSignal();
    }
  }

  const runtime = new RuntimeBuilder()
    .withBuiltIns()
    .withStepExecutor(
      StoppingRecoverableStepDef,
      () => new StoppingRecoverableStepExecutor(),
    )
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef("stopping-recoverable-step-flow", [
      new StoppingRecoverableStepDef(),
    ]),
    {},
  );

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.equal(attempts, 1);
}

async function testRecoverThrowLeavesStepFailedWithReplacementError() {
  const runtime = Runtime.default();

  const execution = runtime.createFlowExecution(
    new FlowDef("recover-throws", [
      new TaskStepDef(
        () => {
          throw new Error("primary-failure");
        },
        {
          retry: { maxAttempts: 2 },
          recover: () => {
            throw new Error("recover-failure");
          },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /recover-failure/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.match(String(execution.getError()), /recover-failure/);
}

async function testHooksRunOncePerLogicalRetriedStep() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-hooks", [
      new TaskStepDef(
        () => {
          attempts += 1;

          if (attempts < 3) {
            throw new Error(`attempt-${attempts}`);
          }

          events.push(`task:${attempts}`);
        },
        {
          hooks: {
            pre: [() => events.push("pre")],
            post: [(_ctx, { status, outcome }) => {
              events.push(`post:${status}:${outcome?.kind}`);
            }],
          },
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    {},
  );

  await execution.start();

  assert.equal(attempts, 3);
  assert.deepEqual(events, ["pre", "task:3", "post:running:completed"]);
}

async function testPostHooksObserveFinalRetryFailureOnce() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-post-failure", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error(`attempt-${attempts}`);
        },
        {
          hooks: {
            post: [(_ctx, { status, outcome }) => {
              assert.ok(outcome instanceof StepExecutionFailedOutcome);
              events.push(
                `post:${status}:${outcome.kind}:${(outcome.error as Error).message}`,
              );
            }],
          },
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /attempt-3/);

  assert.equal(attempts, 3);
  assert.deepEqual(events, ["post:running:failed:attempt-3"]);
}

async function testChildFlowRetryRerunsAgainstCurrentMutableContext() {
  const runtime = Runtime.default();

  const childFlow = new FlowDef<{ count: number; events: string[] }>(
    "child-retry-flow",
    [
      new TaskStepDef((ctx: { count: number; events: string[] }) => {
        ctx.count += 1;
        ctx.events.push(`child:${ctx.count}`);

        if (ctx.count === 1) {
          throw new Error("child-fail");
        }
      }),
    ],
  );

  const execution = runtime.createFlowExecution(
    new FlowDef<{ count: number; events: string[] }>("parent-retry-flow", [
      new ChildFlowStepDef(childFlow, undefined, {
        retry: { maxAttempts: 2 },
      }),
    ]),
    { count: 0, events: [] },
  );

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(execution.context.count, 2);
  assert.deepEqual(execution.context.events, ["child:1", "child:2"]);
}

async function testRecoveredSagaStepDoesNotRegisterCompensation() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();
  const events: string[] = [];

  const saga = builder
    .saga<{ events: string[] }>("recovered-step-no-compensation")
    .task(() => {
      events.push("step-1");
      throw new Error("step-1-fail");
    })
    .retry({ maxAttempts: 2 })
    .recover(() => {
      events.push("step-1-recovered");
    })
    .compensateWith(() => {
      events.push("step-1-compensate");
    })
    .task(() => {
      throw new Error("step-2-fail");
    })
    .build();

  await assert.rejects(async () => {
    await runtime.createFlowExecution(saga, { events }).start();
  }, /step-2-fail/);

  assert.deepEqual(events, ["step-1", "step-1", "step-1-recovered"]);
}

async function testCompletedStepWithPostHookFailureStillRegistersCompensation() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();
  const events: string[] = [];

  const saga = builder
    .saga<{ events: string[] }>("completed-step-post-hook-failure")
    .task((ctx) => {
      ctx.events.push("step-1");
    })
    .postHooks(() => {
      throw new Error("post-hook-fail");
    })
    .compensateWith((ctx) => {
      ctx.events.push("step-1-compensate");
    })
    .build();

  const execution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(saga, { events }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /post-hook-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.Compensated);
  assert.deepEqual(events, ["step-1", "step-1-compensate"]);
}

async function testRecoveredPivotStepStillCommitsSaga() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const saga = builder
    .saga("recovered-pivot")
    .task(() => {
      throw new Error("pivot-fail");
    })
    .recover(() => undefined)
    .commit()
    .task(() => {
      throw new Error("after-commit-fail");
    })
    .build();

  const execution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(saga, {}),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /after-commit-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.CompletedWithError);
}

async function testPivotPostHookFailureDoesNotCommitSaga() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();
  const events: string[] = [];

  const saga = builder
    .saga<{ events: string[] }>("pivot-post-hook-failure")
    .task((ctx) => {
      ctx.events.push("before-pivot");
    })
    .compensateWith((ctx) => {
      ctx.events.push("before-pivot-compensate");
    })
    .task((ctx) => {
      ctx.events.push("pivot");
    })
    .postHooks(() => {
      throw new Error("pivot-post-hook-fail");
    })
    .commit()
    .task((ctx) => {
      ctx.events.push("after-pivot");
    })
    .build();

  const execution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(saga, { events }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /pivot-post-hook-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.Compensated);
  assert.deepEqual(events, ["before-pivot", "pivot", "before-pivot-compensate"]);
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

async function testPostHookRunsOnFailureAndPreservesMainError() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const mainError = new Error("main-error");
  const postError = new Error("post-error");
  const events: string[] = [];

  const flow = builder
    .flow()
    .task(() => {
      events.push("task");
      throw mainError;
    })
    .postHooks((_ctx, { status, outcome }) => {
      assert.ok(outcome instanceof StepExecutionFailedOutcome);
      events.push(
        `post:${status}:${outcome.kind}:${outcome.error === mainError}`,
      );
      throw postError;
    })
    .build();

  try {
    await runtime.createFlowExecution(flow, {}).start();
    assert.fail("start() should reject with main error");
  } catch (err) {
    assert.equal(err, mainError, "primary step error should be preserved");
  }

  assert.deepEqual(events, ["task", "post:running:failed:true"]);
}

async function testStepOnFinishedObserverDoesNotOverrideFailure() {
  class FinishedObserverStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "finished-observer-step" });
    }
  }

  const mainError = new Error("step-main-error");

  class FinishedObserverStepExecutor
    implements IStepExecutor<FinishedObserverStepDef>
  {
    async execute(stepExecution: IStepExecution<FinishedObserverStepDef>) {
      stepExecution.context.events.push("task");
      stepExecution.onFinished(() => {
        stepExecution.context.events.push("observer");
        throw new Error("step-observer-error");
      });
      throw mainError;
    }
  }

  const runtime = new RuntimeBuilder()
    .withExecutionFactory(new FlowExecutionFactory())
    .withStepExecutor(
      FinishedObserverStepDef,
      () => new FinishedObserverStepExecutor(),
    )
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef("finished-observer-flow", [new FinishedObserverStepDef()]),
    { events: [] },
  );

  await assert.rejects(async () => {
    await execution.start();
  }, (error: unknown) => error === mainError);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, ["task", "observer"]);
}

async function testStepStopHandlersAreBestEffort() {
  class StopHandlersStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "stop-handlers-step" });
    }
  }

  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  class StopHandlersStepExecutor implements IStepExecutor<StopHandlersStepDef> {
    async execute(stepExecution: IStepExecution<StopHandlersStepDef>) {
      stepExecution.onStopRequested(() => {
        stepExecution.context.events.push("first-stop");
        throw new Error("step-stop-handler-error");
      });

      await new Promise<void>((_resolve, reject) => {
        stepExecution.onStopRequested(() => {
          stepExecution.context.events.push("second-stop");
          reject(new StopSignal());
        });

        markReady();
      });
    }
  }

  const runtime = new RuntimeBuilder()
    .withExecutionFactory(new FlowExecutionFactory())
    .withStepExecutor(
      StopHandlersStepDef,
      () => new StopHandlersStepExecutor(),
    )
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef("stop-handlers-flow", [new StopHandlersStepDef()]),
    { events: [] },
  );

  const startPromise = execution.start();
  await ready;
  execution.requestStop();

  await assert.rejects(async () => {
    await startPromise;
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, ["first-stop", "second-stop"]);
}

async function testHooksWorkForParallelStep() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const branch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("branch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .step("parallel-step")
    .parallel()
    .hooks({
      pre: [
        (_ctx, { status, stepId }) => events.push(`pre:${status}:${stepId}`),
      ],
      post: [
        (_ctx, { status, stepId, outcome }) =>
          events.push(`post:${status}:${outcome?.kind}:${stepId}`),
      ],
    })
    .branch(branch)
    .branch(branch)
    .allSettled()
    .join()
    .build();

  await runtime.createFlowExecution(flow, { events }).start();

  assert.deepEqual(events.slice(0, 4), [
    "pre:running:parallel-step",
    "branch",
    "branch",
    "post:running:completed:parallel-step",
  ]);
}

async function testFlowHooksArePassedToStepExecutionAndMerged() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const flow = builder
    .flow<{}>("flow-with-hooks", {
      hooks: {
        pre: [() => events.push("flow-pre")],
        post: [() => events.push("flow-post")],
      },
    })
    .task(() => {
      events.push("task");
    })
    .hooks({
      pre: [() => events.push("step-pre")],
      post: [() => events.push("step-post")],
    })
    .build();

  await runtime.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, [
    "flow-pre",
    "step-pre",
    "task",
    "step-post",
    "flow-post",
  ]);
}

async function testHookLifecycleOrderWithExecutorHooks() {
  class InstrumentedFlowExecutor<
    TFlow extends FlowDef,
  > extends FlowExecutor<TFlow> {
    constructor(private readonly events: string[]) {
      super();
    }

    override beforeStepStart() {
      this.events.push("executor-before");
    }

    override afterStepFinished() {
      this.events.push("executor-after");
    }
  }

  class InstrumentedFlowExecutionFactory
    implements IFlowExecutionFactory<FlowDef>
  {
    readonly flowKind = FlowDef;

    constructor(private readonly events: string[]) {}

    createFlowExecution<TFlow extends FlowDef>(
      runtime: IFlowRuntime,
      flowDef: TFlow,
      context: InferredContext<TFlow>,
    ): IFlowExecution<TFlow> {
      return new FlowExecution(
        runtime,
        new InstrumentedFlowExecutor<TFlow>(this.events),
        flowDef,
        context,
      );
    }
  }

  const events: string[] = [];
  const runtime = new RuntimeBuilder()
    .withBuiltIns()
    .withExecutionFactory(new InstrumentedFlowExecutionFactory(events))
    .build();

  const builder = createCoreApp().weaver();

  const flow = builder
    .flow("order-check", {
      hooks: {
        pre: [() => events.push("flow-pre")],
        post: [() => events.push("flow-post")],
      },
    })
    .task(() => {
      events.push("execute");
    })
    .hooks({
      pre: [() => events.push("step-pre")],
      post: [() => events.push("step-post")],
    })
    .build();

  await runtime.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, [
    "executor-before",
    "flow-pre",
    "step-pre",
    "execute",
    "step-post",
    "flow-post",
    "executor-after",
  ]);
}

async function testCustomStepExecutorRegistration() {
  class CustomStepDef extends StepDef {
    constructor() {
      super({ id: "custom-step" });
    }
  }

  class CustomStepExecutor implements IStepExecutor<CustomStepDef> {
    constructor(private readonly events: string[]) {}

    async execute(_stepExecution: IStepExecution<CustomStepDef>) {
      this.events.push("custom-step-executed");
    }
  }

  const flow = new FlowDef("custom-flow", [new CustomStepDef()]);

  const noRegistrationRuntime = new RuntimeBuilder()
    .withExecutionFactory(new FlowExecutionFactory())
    .build();

  await assert.rejects(async () => {
    await noRegistrationRuntime.createFlowExecution(flow, {}).start();
  }, /No executor registered for step type 'CustomStepDef'\./);

  const events: string[] = [];
  const registeredRuntime = new RuntimeBuilder()
    .withExecutionFactory(new FlowExecutionFactory())
    .withStepExecutor(CustomStepDef, () => new CustomStepExecutor(events))
    .build();

  await registeredRuntime.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, ["custom-step-executed"]);
}

async function testRuntimeDelegatesToRegistries() {
  class SpyFlowExecutionFactoryRegistry extends FlowExecutionFactoryRegistry {
    registerCount = 0;
    resolveCount = 0;

    override register(executionFactory: IFlowExecutionFactory<any>) {
      this.registerCount += 1;
      super.register(executionFactory);
    }

    override resolve<TFlow extends IFlowDef>(flowDef: TFlow) {
      this.resolveCount += 1;
      return super.resolve(flowDef);
    }
  }

  class SpyStepExecutorRegistry extends StepExecutorRegistry {
    registerCount = 0;
    resolveCount = 0;

    override register(stepType: any, factory: any) {
      this.registerCount += 1;
      super.register(stepType, factory);
    }

    override resolve<TStep extends IStepDef>(stepDef: TStep) {
      this.resolveCount += 1;
      return super.resolve(stepDef);
    }
  }

  const flowExecutionFactoryRegistry = new SpyFlowExecutionFactoryRegistry();
  const stepExecutorRegistry = new SpyStepExecutorRegistry();

  registerBuiltInRuntimeComponents(
    flowExecutionFactoryRegistry,
    stepExecutorRegistry,
  );

  const runtime = new Runtime(
    flowExecutionFactoryRegistry,
    stepExecutorRegistry,
  );

  const builder = createCoreApp().weaver();
  const flow = builder.flow<{ value: number }>().task(() => undefined).build();

  const execution = runtime.createFlowExecution(flow, { value: 1 });
  await execution.start();

  assert.ok(
    flowExecutionFactoryRegistry.registerCount >= 1,
    "execution factory registry should receive factory registrations",
  );
  assert.ok(
    stepExecutorRegistry.registerCount >= 6,
    "step executor registry should receive default step executor registrations",
  );
  assert.equal(
    flowExecutionFactoryRegistry.resolveCount,
    1,
    "execution factory registry should resolve once for flow execution creation",
  );
  assert.ok(
    stepExecutorRegistry.resolveCount >= 1,
    "step executor registry should resolve step executors during execution",
  );
}

async function testSagaCompensationStrategyBestEffort() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const saga = builder
    .saga<{ value: number }>("saga-best-effort", {
      compensatorStrategy: CompensatorStrategy.BestEffort,
    })
    .task(() => {
      events.push("step-1");
    })
    .compensateWith(() => {
      events.push("compensate-1");
    })
    .task(() => {
      events.push("step-2");
    })
    .compensateWith(() => {
      events.push("compensate-2-fail");
      throw new Error("compensation-2-error");
    })
    .task(() => {
      throw new Error("force-fail");
    })
    .build();

  const sagaExecution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(saga, { value: 1 }),
  );

  await assert.rejects(async () => {
    await sagaExecution.start();
  }, /force-fail/);

  assert.deepEqual(events, [
    "step-1",
    "step-2",
    "compensate-2-fail",
    "compensate-1",
  ]);

  assert.equal(
    sagaExecution.getSagaStatus(),
    SagaStatus.CompensatedWithError,
    "best-effort compensation with failing compensation should end compensated-with-error",
  );
}

async function testSagaCompensationFailFastPreservesOriginalError() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const saga = builder
    .saga<{ events: string[] }>("saga-fail-fast-finalizer")
    .task((ctx) => {
      ctx.events.push("step-1");
    })
    .compensateWith((ctx) => {
      ctx.events.push("compensate-1-fail");
      throw new Error("compensation-fail-fast-error");
    })
    .task(() => {
      throw new Error("main-flow-fail");
    })
    .build();

  const execution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(saga, { events }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /main-flow-fail/);

  assert.deepEqual(events, ["step-1", "compensate-1-fail"]);
  assert.equal(execution.getSagaStatus(), SagaStatus.CompensatedWithError);
}

function testSagaBuilderPreservesProvidedId() {
  const builder = createSagaApp().weaver();

  const saga = builder
    .saga("my-saga-id")
    .task(() => undefined)
    .build();

  assert.equal(saga.id, "my-saga-id");
}

async function testSagaStatusInference() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const preCommitFailSaga = builder
    .saga<{ value: number }>("pre-commit-fail")
    .task(() => undefined)
    .compensateWith(() => undefined)
    .task(() => {
      throw new Error("boom");
    })
    .build();

  const preCommitFailExecution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(preCommitFailSaga, {
      value: 1,
    }),
  );

  await assert.rejects(async () => {
    await preCommitFailExecution.start();
  }, /boom/);

  assert.equal(
    preCommitFailExecution.getSagaStatus(),
    SagaStatus.Compensated,
    "failed pre-commit saga should end compensated",
  );

  const committedFailSaga = builder
    .saga<{ value: number }>("committed-fail")
    .task(() => undefined)
    .compensateWith(() => undefined)
    .commit()
    .task(() => {
      throw new Error("after-commit-fail");
    })
    .build();

  const committedFailExecution = asSagaExecution<SagaExecution>(
    runtime.createFlowExecution(committedFailSaga, {
      value: 1,
    }),
  );

  await assert.rejects(async () => {
    await committedFailExecution.start();
  }, /after-commit-fail/);

  assert.equal(
    committedFailExecution.getSagaStatus(),
    SagaStatus.CompletedWithError,
    "failed committed saga should end completed-with-error",
  );
}

async function testParentSagaDoesNotAutoCompensateChildSagas() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const events: string[] = [];

  const completedChildSaga = builder
    .saga<{ events: string[] }>("completed-child")
    .task((ctx) => {
      ctx.events.push("child-a-step");
    })
    .compensateWith((ctx) => {
      ctx.events.push("child-a-compensate");
    })
    .task(() => undefined)
    .build();

  const failingChildSaga = builder
    .saga<{ events: string[] }>("failing-child")
    .task((ctx) => {
      ctx.events.push("child-b-step");
    })
    .compensateWith((ctx) => {
      ctx.events.push("child-b-compensate");
    })
    .task(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("child-b-fail");
    })
    .build();

  const parentSaga = builder
    .saga<{ events: string[] }>("parent-saga")
    .parallel()
    .branch(completedChildSaga)
    .branch(failingChildSaga)
    .failFast()
    .join()
    .build();

  await assert.rejects(
    async () => {
      await runtime.createFlowExecution(parentSaga, { events }).start();
    },
    /child-b-fail/,
  );

  assert.ok(
    events.includes("child-b-compensate"),
    "failed child saga should self-compensate",
  );
  assert.ok(
    !events.includes("child-a-compensate"),
    "completed sibling child saga should not be auto-compensated by parent saga",
  );
  assert.ok(
    events.includes("child-a-step"),
    "completed sibling child saga should still execute normally",
  );
}

async function testWeaverNestedFactories() {
  const app = createSagaApp();
  const runtime = app.runtime();
  const weaver = app.weaver();

  const parentFlow = weaver
    .flow<{ events: string[] }>("parent")
    .parallel()
    .branch((nestedWeaver) =>
      nestedWeaver
        .flow<{ events: string[] }>("child-flow")
        .task((ctx: { events: string[] }) => {
          ctx.events.push("child-flow-step");
        })
        .build(),
    )
    .branch((nestedWeaver) =>
      nestedWeaver
        .saga<{ events: string[] }>("child-saga")
        .task((ctx: { events: string[] }) => {
          ctx.events.push("child-saga-step");
        })
        .compensateWith((ctx: { events: string[] }) => {
          ctx.events.push("child-saga-compensate");
        })
        .task(() => {
          throw new Error("child-saga-fail");
        })
        .build(),
    )
    .failFast()
    .join()
    .build();

  const execution = runtime.createFlowExecution(parentFlow, { events: [] });

  await assert.rejects(
    async () => {
      await execution.start();
    },
    /child-saga-fail/,
  );

  assert.ok(
    (execution.context as { events: string[] }).events.includes(
      "child-saga-compensate",
    ),
    "child saga built through nested factories should compensate on failure",
  );
}

function testFlowWeaveBuilderSnapshotsRuntimeComponents() {
  class SnapshotFlowDef extends FlowDef {
    static readonly flowKind = SnapshotFlowDef;
  }

  class SnapshotExecutionFactory
    implements IFlowExecutionFactory<SnapshotFlowDef>
  {
    readonly flowKind = SnapshotFlowDef;

    createFlowExecution<TFlow extends SnapshotFlowDef>(
      runtime: IFlowRuntime,
      flowDef: TFlow,
      context: InferredContext<TFlow>,
    ) {
      return new FlowExecution(runtime, new FlowExecutor(), flowDef, context);
    }
  }

  const snapshotPlugin: FlowPlugin = {
    id: "snapshot-runtime-plugin",
    installWeaver(builder) {
      return builder;
    },
    installRuntime(builder) {
      builder.withExecutionFactory(new SnapshotExecutionFactory());
    },
  };

  const builder = FlowWeave.create();
  const app1 = builder.build();
  const snapshotFlow = new SnapshotFlowDef("snapshot-flow", []);

  assert.equal(
    app1.runtime().canRun(snapshotFlow),
    false,
    "runtime built before plugin install should not gain new factories later",
  );

  builder.use(snapshotPlugin);

  const app2 = builder.build();

  assert.equal(
    app1.runtime().canRun(snapshotFlow),
    false,
    "previously built runtime should stay isolated from later builder mutations",
  );
  assert.equal(
    app2.runtime().canRun(snapshotFlow),
    true,
    "new runtime should include plugin-installed execution factories",
  );
}

function testCoreRuntimeDoesNotRunSagaByDefault() {
  const builder = createSagaApp().weaver();
  const runtime = createCoreApp().runtime();

  const saga = builder
    .saga<{ events: string[] }>("plugin-only-saga")
    .task((ctx) => {
      ctx.events.push("saga-step");
    })
    .build();

  assert.equal(runtime.canRun(saga), false);
  assert.throws(
    () => {
      runtime.createFlowExecution(saga, { events: [] });
    },
    /Execution factory not found/,
  );
}

async function testBuiltInTaskExecutorSupportsSubclasses() {
  class DerivedTaskStepDef extends TaskStepDef<
    { events: string[] },
    (ctx: { events: string[] }) => void
  > {
    constructor() {
      super((ctx) => {
        ctx.events.push("derived-task");
      });
    }
  }

  const runtime = Runtime.default();
  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("derived-task-flow", [new DerivedTaskStepDef()]),
    { events: [] },
  );

  await execution.start();

  assert.deepEqual(execution.context.events, ["derived-task"]);
}

async function testExactTaskExecutorRegistrationOverridesBaseExecutor() {
  class DerivedTaskStepDef extends TaskStepDef<
    { events: string[] },
    (ctx: { events: string[] }) => void
  > {
    constructor() {
      super((ctx) => {
        ctx.events.push("base-task");
      });
    }
  }

  class DerivedTaskStepExecutor implements IStepExecutor<DerivedTaskStepDef> {
    async execute(stepExecution: IStepExecution<DerivedTaskStepDef>) {
      stepExecution.context.events.push("override-task");
    }
  }

  const runtime = new RuntimeBuilder()
    .withBuiltIns()
    .withStepExecutor(DerivedTaskStepDef, () => new DerivedTaskStepExecutor())
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>(
      "derived-task-override-flow",
      [new DerivedTaskStepDef()],
    ),
    { events: [] },
  );

  await execution.start();

  assert.deepEqual(execution.context.events, ["override-task"]);
}

async function testSwitchCompletesWhenNoBranchMatchesAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const branch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("branch-started");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .switchOn(async () => {
      execution.requestStop();
      return "miss";
    })
    .case("hit", branch)
    .end()
    .build();

  execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, []);
}

async function testForEachCompletesWhenItemsAreEmptyAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .forEach(async () => {
      execution.requestStop();
      return [] as number[];
    })
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .build();

  execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, []);
}

async function testForEachStopsBeforeStartingNextItemAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);

      if (ctx.item === 1) {
        execution.requestStop();
      }
    })
    .build();

  const flow = builder
    .flow<{ items: number[]; events: string[] }>()
    .forEach((ctx) => ctx.items)
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .build();

  execution = runtime.createFlowExecution(flow, { items: [1, 2], events: [] });

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (err: unknown) => err instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual((execution.context as { events: string[] }).events, ["item:1"]);
}

async function testWhileCompletesWhenLastStartedIterationFinishesAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const iterationFlow = builder
    .flow<{ count: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push("iteration");
      execution.requestStop();
      ctx.count += 1;
    })
    .build();

  const flow = builder
    .flow<{ count: number; events: string[] }>()
    .while((ctx) => ctx.count === 0, iterationFlow)
    .build();

  execution = runtime.createFlowExecution(flow, { count: 0, events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, ["iteration"]);
}

async function testWhileCompletesWhenConditionEndsWithoutStartingIterationAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const iterationFlow = builder
    .flow<{ count: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push("iteration");
      ctx.count += 1;
    })
    .build();

  const flow = builder
    .flow<{ count: number; events: string[] }>()
    .while(async () => {
      execution.requestStop();
      return false;
    }, iterationFlow)
    .build();

  execution = runtime.createFlowExecution(flow, { count: 0, events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, []);
}

async function testParallelStepCompletesWhenStartedBranchesFinishAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const stoppingBranch = builder
    .flow<{ events: string[] }>()
    .task(async (ctx) => {
      await Promise.resolve();
      execution.requestStop();
      ctx.events.push("stopping-branch");
    })
    .build();
  const siblingBranch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("sibling-branch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallel()
    .branch(stoppingBranch)
    .branch(siblingBranch)
    .allSettled()
    .join()
    .build();

  execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events.sort(), [
    "sibling-branch",
    "stopping-branch",
  ]);
}

async function testParallelFailFastStopsOtherRunningBranches() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const failingBranch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("failing-branch");
      throw new Error("fail-fast-error");
    })
    .build();
  const loserBranch = builder
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("loser-branch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallel()
    .branch(failingBranch)
    .branch(loserBranch)
    .failFast()
    .join()
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await assert.rejects(async () => {
    await execution.start();
  }, /fail-fast-error/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events, ["failing-branch"]);
}

async function testParallelFirstSettledStopsLosingBranches() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const winnerBranch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("winner-branch");
    })
    .build();
  const loserBranch = builder
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("loser-branch");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallel()
    .branch(winnerBranch)
    .branch(loserBranch)
    .firstSettled()
    .join()
    .task((ctx) => {
      ctx.events.push("after-parallel");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, [
    "winner-branch",
    "after-parallel",
  ]);
}

async function testParallelFirstCompletedWaitsForUnstoppableLosersToSettle() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const winnerBranch = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("winner-branch");
    })
    .build();
  const unstoppableLoserBranch = builder
    .flow<{ events: string[] }>()
    .task(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      ctx.events.push("loser-settled");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallel()
    .branch(winnerBranch)
    .branch(unstoppableLoserBranch)
    .firstCompleted()
    .join()
    .task((ctx) => {
      ctx.events.push("after-parallel");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, [
    "winner-branch",
    "loser-settled",
    "after-parallel",
  ]);
}

async function testParallelFirstCompletedFailsWhenNoBranchCompletes() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const failingBranchA = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("fail-a");
      throw new Error("branch-a-fail");
    })
    .build();
  const failingBranchB = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("fail-b");
      throw new Error("branch-b-fail");
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallel()
    .branch(failingBranchA)
    .branch(failingBranchB)
    .firstCompleted()
    .join()
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await assert.rejects(async () => {
    await execution.start();
  }, /branch-a-fail|branch-b-fail/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.deepEqual(execution.context.events.sort(), ["fail-a", "fail-b"]);
}

async function testParallelForEachFirstSettledStopsRemainingItems() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .delay((ctx) => (ctx.item === 2 ? 50 : 0))
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallelForEach(() => [1, 2])
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .firstSettled()
    .join()
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["item:1"]);
}

async function testParallelForEachFirstSettledHandlesEmptyItems() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const itemFlow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("item");
    })
    .build();
  const flow = builder
    .flow<{ events: string[] }>()
    .parallelForEach(() => [])
    .run(itemFlow)
    .firstSettled()
    .join()
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["after"]);
}

async function testParallelForEachCompletesWhenItemsAreEmptyAfterStop() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  let execution!: IFlowExecution<any>;

  const itemFlow = builder
    .flow<{ item: number; events: string[] }>()
    .task((ctx) => {
      ctx.events.push(`item:${ctx.item}`);
    })
    .build();

  const flow = builder
    .flow<{ events: string[] }>()
    .parallelForEach(async () => {
      execution.requestStop();
      return [] as number[];
    })
    .run(itemFlow, (ctx, item) => ({ item, events: ctx.events }))
    .allSettled()
    .join()
    .build();

  execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, []);
}

async function main() {
  testFlowWeaveCoreAppDoesNotExposeSaga();
  testFlowWeaveSagaPluginExposesSaga();
  testWeaverBuilderSupportsPlugins();
  testFlowWeavePluginDependencies();
  testFlowWeaveBuilderSnapshotsRuntimeComponents();
  await testStopBeforeStart();
  await testFlowOnFinishedObserverDoesNotOverrideFailure();
  await testFlowOnFinishedObserverDoesNotFailSuccess();
  testFlowStopHandlersAreBestEffort();
  testParallelBuilderStrategies();
  testForEachBuildersRequireRunBeforeBuild();
  await testWhileLoopExecutesIterations();
  await testTaskHooksRunInOrder();
  testStepFlushesCurrentDraftBeforePreparingNextId();
  testHooksCannotBeUsedAfterStepUntilNextStepExists();
  await testDelayStepCompletesAndUsesSelector();
  await testDelayStepRejectsInvalidDuration();
  await testDelayStepStopsWhileWaiting();
  await testChildFlowRunsSequentiallyWithAdapt();
  await testChildFlowPropagatesStopToChildFlow();
  await testBreakInsideIfBreaksNearestWhileLoop();
  await testBreakInsideChildFlowBreaksNearestForEachLoop();
  await testBreakOutsideLoopFailsClearly();
  await testBreakInsideParallelFailsClearly();
  await testBreakInsideParallelForEachFailsClearly();
  await testParallelFailFastStopsOtherRunningBranches();
  await testParallelFirstSettledStopsLosingBranches();
  await testParallelFirstCompletedWaitsForUnstoppableLosersToSettle();
  await testParallelFirstCompletedFailsWhenNoBranchCompletes();
  await testParallelForEachFirstSettledStopsRemainingItems();
  await testTryCatchCompletesWithoutCatchWhenTrySucceeds();
  await testTryCatchCompletesAndCatchReceivesError();
  await testTryCatchStopBypassesCatch();
  await testTryCatchCatchFailureFailsStep();
  await testTryCatchRetryRerunsWholeBlock();
  await testStepRetrySucceedsAfterFailures();
  await testStepRetryFailsAfterExhaustion();
  await testStepRetryCanStopEarlyViaShouldRetry();
  await testStepRetryStopsDuringBackoff();
  await testStopSignalIsNotRetried();
  await testStepRecoverRunsAfterRetriesAreExhausted();
  await testPostHooksObserveRecoveredFinalStatus();
  await testRecoverDoesNotInterceptStopRequests();
  await testRecoverThrowLeavesStepFailedWithReplacementError();
  await testHooksRunOncePerLogicalRetriedStep();
  await testPostHooksObserveFinalRetryFailureOnce();
  await testChildFlowRetryRerunsAgainstCurrentMutableContext();
  await testRecoveredSagaStepDoesNotRegisterCompensation();
  await testCompletedStepWithPostHookFailureStillRegistersCompensation();
  await testRecoveredPivotStepStillCommitsSaga();
  await testPivotPostHookFailureDoesNotCommitSaga();
  testStepClassConsumesPendingIdAndSupportsHooks();
  testStepInstanceIgnoresPendingIdAndClearsIt();
  testStepWithIdAndStepInstanceIsRejected();
  await testPostHookRunsOnFailureAndPreservesMainError();
  await testStepOnFinishedObserverDoesNotOverrideFailure();
  await testStepStopHandlersAreBestEffort();
  await testHooksWorkForParallelStep();
  await testFlowHooksArePassedToStepExecutionAndMerged();
  await testHookLifecycleOrderWithExecutorHooks();
  await testCustomStepExecutorRegistration();
  await testBuiltInTaskExecutorSupportsSubclasses();
  await testExactTaskExecutorRegistrationOverridesBaseExecutor();
  await testRuntimeDelegatesToRegistries();
  await testSagaCompensationStrategyBestEffort();
  await testSagaCompensationFailFastPreservesOriginalError();
  testSagaBuilderPreservesProvidedId();
  await testSagaStatusInference();
  await testParentSagaDoesNotAutoCompensateChildSagas();
  await testWeaverNestedFactories();
  testCoreRuntimeDoesNotRunSagaByDefault();
  await testSwitchCompletesWhenNoBranchMatchesAfterStop();
  await testForEachCompletesWhenItemsAreEmptyAfterStop();
  await testForEachStopsBeforeStartingNextItemAfterStop();
  await testWhileCompletesWhenLastStartedIterationFinishesAfterStop();
  await testWhileCompletesWhenConditionEndsWithoutStartingIterationAfterStop();
  await testParallelStepCompletesWhenStartedBranchesFinishAfterStop();
  await testParallelForEachFirstSettledHandlesEmptyItems();
  await testParallelForEachCompletesWhenItemsAreEmptyAfterStop();

  console.log("All tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
