import assert from "assert/strict";
import { test } from "vitest";
import {
  ExecutionStatus,
  FlowExecutionOutcomeKind,
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  StepExecutionFailedOutcome,
  Runtime,
  RuntimeBuilder,
  StopSignal,
  StepExecutorRegistry,
} from "../../src";
import {
  FlowDef,
  StepDef,
  StepDefMetadata,
  TaskStepDef,
} from "../../src/flow";
import { CoreFlowRuntime } from "../../src/runtime";
import { registerBuiltInRuntimeComponents } from "../../src/runtime/built-ins/register-built-in-runtime-components";
import { FlowRuntimeRegistry } from "../../src/runtime/flow-runtime-registry";
import { createCoreApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";
import {
  createConfiguredCoreRuntime,
  TestCoreFlowRuntime,
} from "../helpers/runtime-helpers";

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

  const runtime = createConfiguredCoreRuntime((flowRuntime) => {
    flowRuntime.withStepExecutor(
      StopHandlersStepDef,
      () => new StopHandlersStepExecutor(),
    );
  });
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
    .branch(branch)
    .branch(branch)
    .allSettled()
    .join()
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
  class InstrumentedFlowExecutor<TFlow extends FlowDef>
    implements IFlowExecutor<TFlow>
  {
    constructor(private readonly events: string[]) {}

    async execute(flowExecution: IFlowExecution<TFlow>) {
      for (const stepDef of flowExecution.flowDef.steps) {
        const stepExecution = flowExecution.createStepExecution(stepDef);
        this.events.push("executor-before");

        try {
          await stepExecution.start();
        } finally {
          this.events.push("executor-after");
        }
      }
    }
  }

  class InstrumentedFlowRuntime extends CoreFlowRuntime {
    constructor(
      private readonly events: string[],
      stepExecutorRegistry?: StepExecutorRegistry,
    ) {
      super(stepExecutorRegistry);
    }

    override clone() {
      return new InstrumentedFlowRuntime(
        this.events,
        this.cloneStepExecutorRegistry(),
      );
    }

    protected override createFlowExecutor<TFlow extends FlowDef>(
      _flowDef: TFlow,
    ): IFlowExecutor<TFlow> {
      return new InstrumentedFlowExecutor<TFlow>(this.events);
    }
  }

  const events: string[] = [];
  const runtime = new RuntimeBuilder()
    .withFlowRuntime(new InstrumentedFlowRuntime(events))
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
    .withFlowRuntime(new CoreFlowRuntime())
    .build();

  await assert.rejects(async () => {
    await noRegistrationRuntime.createFlowExecution(flow, {}).start();
  }, /No executor registered for step type 'CustomStepDef'\./);

  const events: string[] = [];
  const registeredRuntime = createConfiguredCoreRuntime((flowRuntime) => {
    flowRuntime.withStepExecutor(CustomStepDef, () => new CustomStepExecutor(events));
  });

  await registeredRuntime.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, ["custom-step-executed"]);
}

async function testCustomFlowExecutorCanUseFlowExecutionCreateStepExecution() {
  class PublicFlowExecutor<TFlow extends FlowDef>
    implements IFlowExecutor<TFlow>
  {
    async execute(flowExecution: IFlowExecution<TFlow>) {
      for (const stepDef of flowExecution.flowDef.steps) {
        const stepExecution = flowExecution.createStepExecution(stepDef);
        await stepExecution.start();
      }
    }
  }

  class PublicFlowRuntime extends CoreFlowRuntime {
    override clone() {
      return new PublicFlowRuntime(this.cloneStepExecutorRegistry());
    }

    constructor(stepExecutorRegistry?: StepExecutorRegistry) {
      super(stepExecutorRegistry);
    }

    protected override createFlowExecutor<TFlow extends FlowDef>(
      _flowDef: TFlow,
    ): IFlowExecutor<TFlow> {
      return new PublicFlowExecutor<TFlow>();
    }
  }

  const events: string[] = [];
  const runtime = new RuntimeBuilder()
    .withFlowRuntime(new PublicFlowRuntime())
    .build();
  const builder = createCoreApp().weaver();

  const flow = builder
    .flow<{ events: string[] }>(undefined, {
      hooks: {
        pre: [() => events.push("flow-pre")],
        post: [() => events.push("flow-post")],
      },
    })
    .task((ctx) => {
      ctx.events.push("task");
    })
    .hooks({
      pre: [() => events.push("step-pre")],
      post: [() => events.push("step-post")],
    })
    .build();

  await runtime.createFlowExecution(flow, { events }).start();

  assert.deepEqual(events, ["flow-pre", "step-pre", "task", "step-post", "flow-post"]);
}

async function testRuntimeDelegatesToRegistries() {
  class SpyFlowRuntimeRegistry extends FlowRuntimeRegistry {
    registerCount = 0;
    resolveCount = 0;

    override register(flowRuntime: any) {
      this.registerCount += 1;
      super.register(flowRuntime);
    }

    override resolve<TFlow extends IFlowDef>(flowDef: TFlow) {
      this.resolveCount += 1;
      return super.resolve(flowDef);
    }
  }

  class SpyCoreFlowRuntime extends CoreFlowRuntime {
    registerCount = 0;
    resolveCount = 0;

    constructor(stepExecutorRegistry?: StepExecutorRegistry) {
      super(stepExecutorRegistry);
      this.registerCount = this.cloneStepExecutorRegistry().entries().length;
    }

    override clone() {
      return new SpyCoreFlowRuntime(this.cloneStepExecutorRegistry());
    }

    override withStepExecutor(stepType: any, factory: any) {
      this.registerCount += 1;
      return super.withStepExecutor(stepType, factory);
    }

    protected override resolveStepExecutor<TStep extends IStepDef>(stepDef: TStep) {
      this.resolveCount += 1;
      return super.resolveStepExecutor(stepDef);
    }
  }

  const flowRuntimeRegistry = new SpyFlowRuntimeRegistry();

  registerBuiltInRuntimeComponents(flowRuntimeRegistry);

  const coreFlowRuntime = new SpyCoreFlowRuntime();
  flowRuntimeRegistry.register(coreFlowRuntime);

  const runtime = new Runtime(flowRuntimeRegistry);

  const builder = createCoreApp().weaver();
  const flow = builder.flow<{ value: number }>().task(() => undefined).build();

  const execution = runtime.createFlowExecution(flow, { value: 1 });
  await execution.start();

  assert.ok(
    flowRuntimeRegistry.registerCount >= 2,
    "flow runtime registry should receive flow runtime registrations",
  );
  assert.ok(
    coreFlowRuntime.registerCount >= 6,
    "flow runtime should register built-in step executors",
  );
  assert.equal(
    flowRuntimeRegistry.resolveCount,
    1,
    "flow runtime registry should resolve once for flow execution creation",
  );
  assert.ok(
    coreFlowRuntime.resolveCount >= 1,
    "flow runtime should resolve step executors during execution",
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

  const runtime = createConfiguredCoreRuntime((flowRuntime) => {
    flowRuntime.withStepExecutor(
      DerivedTaskStepDef,
      () => new DerivedTaskStepExecutor(),
    );
  });
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

test("post hook runs on failure and preserves main error", testPostHookRunsOnFailureAndPreservesMainError);
test("step stop handlers are best effort", testStepStopHandlersAreBestEffort);
test("hooks work for parallel step", testHooksWorkForParallelStep);
test("flow hooks are passed to step execution and merged", testFlowHooksArePassedToStepExecutionAndMerged);
test("hook lifecycle order with executor hooks", testHookLifecycleOrderWithExecutorHooks);
test("custom step executor registration works", testCustomStepExecutorRegistration);
test("custom flow executor can use flowExecution.createStepExecution", testCustomFlowExecutorCanUseFlowExecutionCreateStepExecution);
test("runtime delegates to registries", testRuntimeDelegatesToRegistries);
test("built-in task executor supports subclasses", testBuiltInTaskExecutorSupportsSubclasses);
test("exact task executor registration overrides base executor", testExactTaskExecutorRegistrationOverridesBaseExecutor);
