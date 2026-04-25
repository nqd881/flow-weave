import assert from "assert/strict";
import { test } from "vitest";
import {
  ExecutionStatus,
  FlowExecutionOutcomeKind,
  StopSignal,
} from "../../src";
import { FlowDef, TaskStepDef } from "../../src/flow";
import { createCoreApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";

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
  const statuses: ExecutionStatus[] = [];

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
    .catch(catchFlow, (ctx, error) => ({
      message: (error as Error).message,
      events: ctx.events,
    }))
    .end()
    .postHooks((_ctx, info) => {
      statuses.push(info.status);
    })
    .task((ctx) => {
      ctx.events.push("after");
    })
    .build();

  const execution = runtime.createFlowExecution(flow, { events: [] });

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["try", "catch:boom", "after"]);
  assert.deepEqual(statuses, [ExecutionStatus.Running]);
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
    .catch(catchFlow)
    .end()
    .retry({ maxAttempts: 2 })
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

test("try-catch completes without catch when try succeeds", testTryCatchCompletesWithoutCatchWhenTrySucceeds);
test("try-catch completes and catch receives error", testTryCatchCompletesAndCatchReceivesError);
test("try-catch stop bypasses catch", testTryCatchStopBypassesCatch);
test("try-catch catch failure fails step", testTryCatchCatchFailureFailsStep);
test("try-catch retry reruns whole block", testTryCatchRetryRerunsWholeBlock);
