import assert from "assert/strict";
import { test } from "vitest";
import {
  FlowExecutionOutcomeKind,
  IFlowExecution,
  InferredContext,
  IStepDef,
  IStepExecution,
  IStepExecutor,
  Runtime,
  RuntimeBuilder,
  StopSignal,
  StepExecutorRegistry,
} from "../../src";
import {
  ChildFlowStepDef,
  DelayStepDef,
  FlowDef,
  StepDef,
  TaskStepDef,
} from "../../src/flow";
import { CoreFlowRuntime } from "../../src/runtime";
import { createCoreApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";
import {
  createConfiguredCoreRuntime,
  TestCoreFlowRuntime,
} from "../helpers/runtime-helpers";

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

async function testCustomStepExecutorCanUseRuntimeChildExecutionHelper() {
  class ChildExecutionHelperStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "child-execution-helper-step" });
    }
  }

  const childFlow = createCoreApp()
    .weaver()
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("child-finished");
    })
    .build();

  class ChildExecutionHelperStepExecutor
    implements IStepExecutor<ChildExecutionHelperStepDef>
  {
    async execute(stepExecution: IStepExecution<ChildExecutionHelperStepDef>) {
      const childExecution = stepExecution.createChildFlowExecution(
        childFlow,
        stepExecution.context,
      );

      await childExecution.start();
    }
  }

  const runtime = createConfiguredCoreRuntime((provider) => {
    provider.withStepExecutor(
      ChildExecutionHelperStepDef,
      () => new ChildExecutionHelperStepExecutor(),
    );
  });
  const execution = runtime.createFlowExecution(
    new FlowDef("child-execution-helper-flow", [
      new ChildExecutionHelperStepDef(),
    ]),
    { events: [] },
  );

  const startPromise = execution.start();
  execution.requestStop();

  await assert.rejects(async () => {
    await startPromise;
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

async function testRuntimeCreateChildFlowExecutionStopsOnStartForStoppedParentStepExecution() {
  class StoppedParentChildStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "stopped-parent-child-step" });
    }
  }

  const childFlow = createCoreApp()
    .weaver()
    .flow<{ events: string[] }>()
    .delay(50)
    .task((ctx) => {
      ctx.events.push("child-finished");
    })
    .build();

  class StoppedParentChildStepExecutor
    implements IStepExecutor<StoppedParentChildStepDef>
  {
    async execute(stepExecution: IStepExecution<StoppedParentChildStepDef>) {
      stepExecution.requestStop();

      const childExecution = stepExecution.createChildFlowExecution(
        childFlow,
        stepExecution.context,
      );

      await assert.rejects(async () => {
        await childExecution.start();
      }, (error: unknown) => error instanceof StopSignal);

      if (stepExecution.isStopRequested()) {
        throw new StopSignal();
      }
    }
  }

  const runtime = createConfiguredCoreRuntime((provider) => {
    provider.withStepExecutor(
      StoppedParentChildStepDef,
      () => new StoppedParentChildStepExecutor(),
    );
  });
  const execution = runtime.createFlowExecution(
    new FlowDef("stopped-parent-child-flow", [new StoppedParentChildStepDef()]),
    { events: [] },
  );

  await assert.rejects(async () => {
    await execution.start();
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

async function testCreateChildFlowExecutionPropagatesStopWithWrappedPublicProvider() {
  class ExternalChildFlowDef extends FlowDef<{ events: string[] }> {
    static readonly flowKind = ExternalChildFlowDef;
  }

  class ExternalChildFlowExecution<TFlow extends ExternalChildFlowDef>
    implements IFlowExecution<TFlow>
  {
    static nextId = 0;

    readonly id = `external-child-${++ExternalChildFlowExecution.nextId}`;

    constructor(protected readonly inner: IFlowExecution<TFlow>) {}

    get flowDef() {
      return this.inner.flowDef;
    }

    get context() {
      return this.inner.context;
    }

    createStepExecution<TStep extends IStepDef>(stepDef: TStep) {
      return this.inner.createStepExecution(stepDef);
    }

    getStatus() {
      return this.inner.getStatus();
    }

    getOutcome() {
      return this.inner.getOutcome();
    }

    getError() {
      return this.inner.getError();
    }

    async start() {
      await this.inner.start();
    }

    requestStop() {
      this.inner.requestStop();
    }

    isStopRequested() {
      return this.inner.isStopRequested();
    }

    onStopRequested(action: () => any) {
      this.inner.onStopRequested(action);
    }
  }

  class ExternalChildFlowRuntime
    extends TestCoreFlowRuntime<ExternalChildFlowDef>
  {
    readonly flowKind = ExternalChildFlowDef;

    override clone() {
      return new ExternalChildFlowRuntime(
        this.cloneStepExecutorRegistry(),
      );
    }

    override createFlowExecution<TFlow extends ExternalChildFlowDef>(
      flowDef: TFlow,
      context: InferredContext<TFlow>,
    ): IFlowExecution<TFlow> {
      const inner = super.createFlowExecution(flowDef, context);

      return new ExternalChildFlowExecution(
        inner as unknown as IFlowExecution<TFlow>,
      );
    }
  }

  class ChildExecutionHelperStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "child-execution-helper-non-base-step" });
    }
  }

  const childFlow = new ExternalChildFlowDef("non-base-child-flow", [
    new DelayStepDef<{ events: string[] }>(() => 50),
    new TaskStepDef((ctx: { events: string[] }) => {
      ctx.events.push("child-finished");
    }),
  ]);

  class ChildExecutionHelperStepExecutor
    implements IStepExecutor<ChildExecutionHelperStepDef>
  {
    async execute(stepExecution: IStepExecution<ChildExecutionHelperStepDef>) {
      const childExecution = stepExecution.createChildFlowExecution(
        childFlow,
        stepExecution.context,
      );

      await childExecution.start();
    }
  }

  const runtime = new RuntimeBuilder()
    .withFlowRuntime(
      new CoreFlowRuntime().withStepExecutor(
        ChildExecutionHelperStepDef,
        () => new ChildExecutionHelperStepExecutor(),
      ),
    )
    .withFlowRuntime(new ExternalChildFlowRuntime())
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef("child-execution-helper-non-base-flow", [
      new ChildExecutionHelperStepDef(),
    ]),
    { events: [] },
  );

  const startPromise = execution.start();
  execution.requestStop();

  await assert.rejects(async () => {
    await startPromise;
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

async function testCreateChildFlowExecutionBypassesWrappedPublicProviderInternally() {
  class ExternalChildFlowDef extends FlowDef<{ events: string[] }> {
    static readonly flowKind = ExternalChildFlowDef;
  }

  class TrackingExternalChildFlowExecution<TFlow extends ExternalChildFlowDef>
    implements IFlowExecution<TFlow>
  {
    static nextId = 0;

    readonly id = `tracking-external-child-${++TrackingExternalChildFlowExecution.nextId}`;
    stopRequests = 0;

    constructor(protected readonly inner: IFlowExecution<TFlow>) {}

    get flowDef() {
      return this.inner.flowDef;
    }

    get context() {
      return this.inner.context;
    }

    createStepExecution<TStep extends IStepDef>(stepDef: TStep) {
      return this.inner.createStepExecution(stepDef);
    }

    getStatus() {
      return this.inner.getStatus();
    }

    getOutcome() {
      return this.inner.getOutcome();
    }

    getError() {
      return this.inner.getError();
    }

    async start() {
      await this.inner.start();
    }

    requestStop() {
      this.stopRequests += 1;
      this.inner.requestStop();
    }

    isStopRequested() {
      return this.inner.isStopRequested();
    }

    onStopRequested(action: () => any) {
      this.inner.onStopRequested(action);
    }
  }

  class TrackingExternalChildFlowRuntime
    extends TestCoreFlowRuntime<ExternalChildFlowDef>
  {
    readonly flowKind = ExternalChildFlowDef;

    constructor(
      readonly created: TrackingExternalChildFlowExecution<any>[],
      stepExecutorRegistry?: StepExecutorRegistry,
    ) {
      super(stepExecutorRegistry);
    }

    override clone() {
      return new TrackingExternalChildFlowRuntime(
        this.created,
        this.cloneStepExecutorRegistry(),
      );
    }

    override createFlowExecution<TFlow extends ExternalChildFlowDef>(
      flowDef: TFlow,
      context: InferredContext<TFlow>,
    ): IFlowExecution<TFlow> {
      const inner = super.createFlowExecution(flowDef, context);
      const execution = new TrackingExternalChildFlowExecution(
        inner as unknown as IFlowExecution<TFlow>,
      );

      this.created.push(execution);

      return execution;
    }
  }

  class ChildExecutionHelperStepDef extends StepDef<{ events: string[] }> {
    constructor() {
      super({ id: "child-execution-helper-non-base-detach-step" });
    }
  }

  const childFlow = new ExternalChildFlowDef("non-base-child-detach-flow", [
    new TaskStepDef((ctx: { events: string[] }) => {
      ctx.events.push("child-finished");
    }),
  ]);

  class ChildExecutionHelperStepExecutor
    implements IStepExecutor<ChildExecutionHelperStepDef>
  {
    async execute(stepExecution: IStepExecution<ChildExecutionHelperStepDef>) {
      const childExecution = stepExecution.createChildFlowExecution(
        childFlow,
        stepExecution.context,
      );

      await childExecution.start();
    }
  }

  const createdChildExecutions: TrackingExternalChildFlowExecution<any>[] = [];
  const runtime = new RuntimeBuilder()
    .withFlowRuntime(
      new CoreFlowRuntime().withStepExecutor(
        ChildExecutionHelperStepDef,
        () => new ChildExecutionHelperStepExecutor(),
      ),
    )
    .withFlowRuntime(
      new TrackingExternalChildFlowRuntime(createdChildExecutions),
    )
    .build();
  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("child-execution-helper-non-base-detach-flow", [
      new ChildExecutionHelperStepDef(),
      new DelayStepDef<{ events: string[] }>(() => 50),
    ]),
    { events: [] },
  );

  setTimeout(() => {
    execution.requestStop();
  }, 10);

  await assert.rejects(async () => {
    await execution.start();
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, ["child-finished"]);
  assert.equal(createdChildExecutions.length, 0);
}

async function testStoppedParentFlowDoesNotRunStepPreHooks() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const flow = builder
    .flow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("task");
    })
    .preHooks((_ctx) => {
      _ctx.events.push("step-pre");
    })
    .build();
  const execution = runtime.createFlowExecution(flow, { events: [] });

  execution.requestStop();

  await assert.rejects(async () => {
    await execution.start();
  }, (error: unknown) => error instanceof StopSignal);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.deepEqual(execution.context.events, []);
}

test("stop before start rejects with StopSignal", testStopBeforeStart);
test("flow stop handlers are best effort", testFlowStopHandlersAreBestEffort);
test("delay step completes and uses selector", testDelayStepCompletesAndUsesSelector);
test("delay step rejects invalid duration", testDelayStepRejectsInvalidDuration);
test("delay step stops while waiting", testDelayStepStopsWhileWaiting);
test("child flow runs sequentially with adapt", testChildFlowRunsSequentiallyWithAdapt);
test("child flow propagates stop to child flow", testChildFlowPropagatesStopToChildFlow);
test("custom step executor can use runtime child execution helper", testCustomStepExecutorCanUseRuntimeChildExecutionHelper);
test("child flow execution stops on start for stopped parent step", testRuntimeCreateChildFlowExecutionStopsOnStartForStoppedParentStepExecution);
test("child flow execution propagates stop with wrapped public flow runtime", testCreateChildFlowExecutionPropagatesStopWithWrappedPublicProvider);
test("child flow execution bypasses wrapped public flow runtime internally", testCreateChildFlowExecutionBypassesWrappedPublicProviderInternally);
test("stopped parent flow does not run step pre-hooks", testStoppedParentFlowDoesNotRunStepPreHooks);
