import assert from "assert/strict";
import { test } from "vitest";
import { UncaughtBreakLoopError } from "../../src";
import {
  CompensatorStrategy,
  SagaStatus,
} from "../../src/saga";
import { createSagaApp } from "../helpers/app-helpers";
import { asSagaExecution } from "../helpers/assertions";

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

  const execution = asSagaExecution(runtime.createFlowExecution(saga, { events }));

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

  const execution = asSagaExecution(runtime.createFlowExecution(saga, {}));

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

  const execution = asSagaExecution(runtime.createFlowExecution(saga, { events }));

  await assert.rejects(async () => {
    await execution.start();
  }, /pivot-post-hook-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.Compensated);
  assert.deepEqual(events, ["before-pivot", "pivot", "before-pivot-compensate"]);
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

  const sagaExecution = asSagaExecution(
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

  const execution = asSagaExecution(
    runtime.createFlowExecution(saga, { events }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /main-flow-fail/);

  assert.deepEqual(events, ["step-1", "compensate-1-fail"]);
  assert.equal(execution.getSagaStatus(), SagaStatus.CompensatedWithError);
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

  const preCommitFailExecution = asSagaExecution(
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

  const committedFailExecution = asSagaExecution(
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

test("recovered saga step does not register compensation", testRecoveredSagaStepDoesNotRegisterCompensation);
test("completed step with post-hook failure still registers compensation", testCompletedStepWithPostHookFailureStillRegistersCompensation);
test("recovered pivot step still commits saga", testRecoveredPivotStepStillCommitsSaga);
test("pivot post-hook failure does not commit saga", testPivotPostHookFailureDoesNotCommitSaga);
test("saga compensation strategy best effort", testSagaCompensationStrategyBestEffort);
test("saga compensation fail-fast preserves original error", testSagaCompensationFailFastPreservesOriginalError);
test("saga status inference", testSagaStatusInference);
test("parent saga does not auto-compensate child sagas", testParentSagaDoesNotAutoCompensateChildSagas);
test("weaver nested factories work with saga", testWeaverNestedFactories);
