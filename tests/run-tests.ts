/// <reference types="node" />
import assert from "assert/strict";
import {
  FlowWeave,
  FlowExecutionStatus,
  FlowStoppedError,
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
  WeaverBuilder,
  Runtime,
  RuntimeBuilder,
  registerBuiltInRuntimeComponents,
  SagaExecution,
  SagaExecutionFactory,
  SagaStatus,
  StepExecutorRegistry,
  sagaPlugin,
} from "../src";
import {
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
    assert.fail("start() should reject with FlowStoppedError");
  } catch (err) {
    assert.ok(err instanceof FlowStoppedError, "expected FlowStoppedError");
  }

  assert.equal(
    execution.getStatus(),
    FlowExecutionStatus.Stopped,
    "status should be Stopped after pre-start stop",
  );
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
        (_ctx, { status, stepId }) => events.push(`post:${status}:${stepId}`),
      ],
    })
    .build();

  await runtime.createFlowExecution(flow, { value: 42 }).start();

  assert.deepEqual(events, [
    "pre:running:hooked-task",
    "task:42",
    "post:completed:hooked-task",
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
    /hooks\(\) can only be used after declaring a simple step\./,
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Failed);
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
    (error: unknown) => error instanceof FlowStoppedError,
  );

  assert.equal(execution.getStatus(), FlowExecutionStatus.Stopped);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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
    (error: unknown) => error instanceof FlowStoppedError,
  );

  assert.equal(execution.getStatus(), FlowExecutionStatus.Stopped);
  assert.deepEqual(execution.context.events, []);
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
    .postHooks((_ctx, { status, error }) => {
      events.push(`post:${status}:${error === mainError}`);
      throw postError;
    })
    .build();

  try {
    await runtime.createFlowExecution(flow, {}).start();
    assert.fail("start() should reject with main error");
  } catch (err) {
    assert.equal(err, mainError, "primary step error should be preserved");
  }

  assert.deepEqual(events, ["task", "post:failed:true"]);
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
        (_ctx, { status, stepId }) => events.push(`post:${status}:${stepId}`),
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
    "post:completed:parallel-step",
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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
    (err: unknown) => err instanceof FlowStoppedError,
  );

  assert.equal(execution.getStatus(), FlowExecutionStatus.Stopped);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events.sort(), [
    "sibling-branch",
    "stopping-branch",
  ]);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
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

  assert.equal(execution.getStatus(), FlowExecutionStatus.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, []);
}

async function main() {
  testFlowWeaveCoreAppDoesNotExposeSaga();
  testFlowWeaveSagaPluginExposesSaga();
  testWeaverBuilderSupportsPlugins();
  testFlowWeavePluginDependencies();
  testFlowWeaveBuilderSnapshotsRuntimeComponents();
  await testStopBeforeStart();
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
  testStepClassConsumesPendingIdAndSupportsHooks();
  testStepInstanceIgnoresPendingIdAndClearsIt();
  testStepWithIdAndStepInstanceIsRejected();
  await testPostHookRunsOnFailureAndPreservesMainError();
  await testHooksWorkForParallelStep();
  await testFlowHooksArePassedToStepExecutionAndMerged();
  await testHookLifecycleOrderWithExecutorHooks();
  await testCustomStepExecutorRegistration();
  await testBuiltInTaskExecutorSupportsSubclasses();
  await testExactTaskExecutorRegistrationOverridesBaseExecutor();
  await testRuntimeDelegatesToRegistries();
  await testSagaCompensationStrategyBestEffort();
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
