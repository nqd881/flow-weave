/// <reference types="node" />
import assert from "assert/strict";
import {
  FlowBuilderClient,
  Client,
  FlowExecutionStatus,
  FlowStoppedError,
  ParallelStepStrategy,
  IClient,
  IFlowEngine,
  IFlowExecution,
  InferredContext,
} from "../src";
import { FlowDef, FlowExecution, FlowExecutor, ParallelStepDef } from "../src/base";

async function testStopBeforeStart() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  const flow = builder
    .newFlow()
    .task(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    })
    .build();

  const execution = client.createFlowExecution(flow, {} as any);

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
  const client = new FlowBuilderClient();

  const baseFlow = client
    .newFlow()
    .task(() => undefined)
    .build();

  const flowFirst = client
    .newFlow()
    .parallel()
    .branch(baseFlow)
    .firstSettled()
    .join()
    .build();

  const firstParallel = flowFirst.steps[0] as ParallelStepDef;
  assert.equal(firstParallel.strategy, ParallelStepStrategy.FirstSettled);

  const flowFailFast = client
    .newFlow()
    .parallel()
    .branch(baseFlow)
    .failFast()
    .join()
    .build();

  const failFastParallel = flowFailFast.steps[0] as ParallelStepDef;
  assert.equal(failFastParallel.strategy, ParallelStepStrategy.FailFast);

  const flowDefault = client
    .newFlow()
    .parallel()
    .branch(baseFlow)
    .firstCompleted()
    .join()
    .build();

  const defaultParallel = flowDefault.steps[0] as ParallelStepDef;
  assert.equal(defaultParallel.strategy, ParallelStepStrategy.FirstCompleted);
}

function testForEachBuildersRequireRunBeforeBuild() {
  const builder = new FlowBuilderClient();

  assert.throws(
    () => {
      builder
        .newFlow<{ items: number[] }>()
        .forEach((ctx) => ctx.items)
        .build();
    },
    /ForEach step requires run\(\.\.\.\) before build\./,
  );

  assert.throws(
    () => {
      builder
        .newFlow<{ items: number[] }>()
        .parallelForEach((ctx) => ctx.items)
        .build();
    },
    /ParallelForEach step requires run\(\.\.\.\) before build\./,
  );
}

async function testWhileLoopExecutesIterations() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  let iterations = 0;

  const loopFlow = builder
    .newFlow<{ count: number }>()
    .task((ctx) => {
      iterations += 1;
      ctx.count += 1;
    })
    .build();

  const flow = builder
    .newFlow<{ count: number }>()
    .while((ctx) => ctx.count < 3, loopFlow)
    .build();

  await client.createFlowExecution(flow, { count: 0 }).start();

  assert.equal(iterations, 3, "loopFlow should run three times");
}

async function testTaskHooksRunInOrder() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  const events: string[] = [];

  const flow = builder
    .newFlow<{ value: number }>()
    .step("hooked-task")
    .task(
      (ctx) => {
        events.push(`task:${ctx.value}`);
      },
      {
        hooks: {
          pre: [(_ctx, { status, stepId }) => events.push(`pre:${status}:${stepId}`)],
          post: [(_ctx, { status, stepId }) => events.push(`post:${status}:${stepId}`)],
        },
      },
    )
    .build();

  await client.createFlowExecution(flow, { value: 42 }).start();

  assert.deepEqual(events, [
    "pre:running:hooked-task",
    "task:42",
    "post:completed:hooked-task",
  ]);
}

async function testPostHookRunsOnFailureAndPreservesMainError() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  const mainError = new Error("main-error");
  const postError = new Error("post-error");
  const events: string[] = [];

  const flow = builder
    .newFlow()
    .task(
      () => {
        events.push("task");
        throw mainError;
      },
      {
        hooks: {
          post: [
            (_ctx, { status, error }) => {
              events.push(`post:${status}:${error === mainError}`);
              throw postError;
            },
          ],
        },
      },
    )
    .build();

  try {
    await client.createFlowExecution(flow, {}).start();
    assert.fail("start() should reject with main error");
  } catch (err) {
    assert.equal(err, mainError, "primary step error should be preserved");
  }

  assert.deepEqual(events, ["task", "post:failed:true"]);
}

async function testHooksWorkForParallelStep() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  const events: string[] = [];

  const branch = builder
    .newFlow<{ events: string[] }>()
    .task((ctx) => {
      ctx.events.push("branch");
    })
    .build();

  const flow = builder
    .newFlow<{ events: string[] }>()
    .step("parallel-step")
    .parallel({
      hooks: {
        pre: [(_ctx, { status, stepId }) => events.push(`pre:${status}:${stepId}`)],
        post: [(_ctx, { status, stepId }) => events.push(`post:${status}:${stepId}`)],
      },
    })
    .branch(branch)
    .branch(branch)
    .allSettled()
    .join()
    .build();

  await client.createFlowExecution(flow, { events }).start();

  assert.deepEqual(events.slice(0, 4), [
    "pre:running:parallel-step",
    "branch",
    "branch",
    "post:completed:parallel-step",
  ]);
}

async function testFlowHooksArePassedToStepExecutionAndMerged() {
  const client = Client.defaultClient();
  const builder = new FlowBuilderClient();

  const events: string[] = [];

  const flow = builder
    .newFlow<{}>("flow-with-hooks", {
      hooks: {
        pre: [() => events.push("flow-pre")],
        post: [() => events.push("flow-post")],
      },
    })
    .task(
      () => {
        events.push("task");
      },
      {
        hooks: {
          pre: [() => events.push("step-pre")],
          post: [() => events.push("step-post")],
        },
      },
    )
    .build();

  await client.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, ["flow-pre", "step-pre", "task", "step-post", "flow-post"]);
}

async function testHookLifecycleOrderWithEngineHooks() {
  class InstrumentedFlowExecutor<TFlow extends FlowDef> extends FlowExecutor<TFlow> {
    constructor(private readonly events: string[]) {
      super();
    }

    override beforeStepStart() {
      this.events.push("engine-before");
    }

    override afterStepFinished() {
      this.events.push("engine-after");
    }
  }

  class InstrumentedFlowEngine implements IFlowEngine<FlowDef> {
    readonly flowKind = FlowDef;

    constructor(private readonly events: string[]) {
    }

    createFlowExecution<TFlow extends FlowDef>(
      client: IClient,
      flowDef: TFlow,
      context: InferredContext<TFlow>,
    ): IFlowExecution<TFlow> {
      return new FlowExecution(
        client,
        new InstrumentedFlowExecutor<TFlow>(this.events),
        flowDef,
        context,
      );
    }
  }

  const events: string[] = [];
  const client = new Client();
  client.registerEngine(new InstrumentedFlowEngine(events));

  const builder = new FlowBuilderClient();

  const flow = builder
    .newFlow("order-check", {
      hooks: {
        pre: [() => events.push("flow-pre")],
        post: [() => events.push("flow-post")],
      },
    })
    .task(
      () => {
        events.push("execute");
      },
      {
        hooks: {
          pre: [() => events.push("step-pre")],
          post: [() => events.push("step-post")],
        },
      },
    )
    .build();

  await client.createFlowExecution(flow, {}).start();

  assert.deepEqual(events, [
    "engine-before",
    "flow-pre",
    "step-pre",
    "execute",
    "step-post",
    "flow-post",
    "engine-after",
  ]);
}

async function main() {
  await testStopBeforeStart();
  testParallelBuilderStrategies();
  testForEachBuildersRequireRunBeforeBuild();
  await testWhileLoopExecutesIterations();
  await testTaskHooksRunInOrder();
  await testPostHookRunsOnFailureAndPreservesMainError();
  await testHooksWorkForParallelStep();
  await testFlowHooksArePassedToStepExecutionAndMerged();
  await testHookLifecycleOrderWithEngineHooks();

  console.log("All tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
