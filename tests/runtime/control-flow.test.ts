import assert from "assert/strict";
import { test } from "vitest";
import {
  BreakLoopSignal,
  FlowExecutionOutcomeKind,
  IFlowExecution,
  ParallelStepStrategy,
  Runtime,
  StopSignal,
  UncaughtBreakLoopError,
} from "../../src";
import { FlowDef } from "../../src/flow";
import { createCoreApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";

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
    (error: unknown) => error instanceof UncaughtBreakLoopError,
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

test("break inside if breaks nearest while loop", testBreakInsideIfBreaksNearestWhileLoop);
test("break inside child flow breaks nearest forEach loop", testBreakInsideChildFlowBreaksNearestForEachLoop);
test("break outside loop fails clearly", testBreakOutsideLoopFailsClearly);
test("break inside parallel fails clearly", testBreakInsideParallelFailsClearly);
test("break inside parallelForEach fails clearly", testBreakInsideParallelForEachFailsClearly);
test("switch completes when no branch matches after stop", testSwitchCompletesWhenNoBranchMatchesAfterStop);
test("forEach completes when items are empty after stop", testForEachCompletesWhenItemsAreEmptyAfterStop);
test("forEach stops before starting next item after stop", testForEachStopsBeforeStartingNextItemAfterStop);
test("while completes when last started iteration finishes after stop", testWhileCompletesWhenLastStartedIterationFinishesAfterStop);
test("while completes when condition ends without starting iteration after stop", testWhileCompletesWhenConditionEndsWithoutStartingIterationAfterStop);
test("parallel step completes when started branches finish after stop", testParallelStepCompletesWhenStartedBranchesFinishAfterStop);
test("parallel fail-fast stops other running branches", testParallelFailFastStopsOtherRunningBranches);
test("parallel first-settled stops losing branches", testParallelFirstSettledStopsLosingBranches);
test("parallel first-completed waits for unstoppable losers", testParallelFirstCompletedWaitsForUnstoppableLosersToSettle);
test("parallel first-completed fails when no branch completes", testParallelFirstCompletedFailsWhenNoBranchCompletes);
test("parallelForEach first-settled stops remaining items", testParallelForEachFirstSettledStopsRemainingItems);
test("parallelForEach first-settled handles empty items", testParallelForEachFirstSettledHandlesEmptyItems);
test("parallelForEach completes when items are empty after stop", testParallelForEachCompletesWhenItemsAreEmptyAfterStop);
