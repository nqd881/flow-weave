import assert from "assert/strict";
import { test } from "vitest";
import { IFlowDef } from "../../src";
import { ChildFlow, Flow, ForEach, Task } from "../../src/authoring/decorator";
import {
  CommitPoint,
  CompensateWith,
  Saga,
  SagaDef,
  SagaStatus,
} from "../../src/saga";
import { asSagaExecution } from "../helpers/assertions";
import { createCoreApp, createSagaApp } from "../helpers/app-helpers";

async function testDecoratedFlowsRunOnExistingRuntimeAndInteropWithBuilder() {
  const app = createCoreApp();
  const runtime = app.runtime();
  const builder = app.weaver();

  const builtChildFlow = builder
    .flow<{ events: string[] }>("built-child")
    .task((ctx) => {
      ctx.events.push("built-child");
    })
    .build();

  @Flow<{ item: number; events: string[] }>("decorated-item")
  class DecoratedItemFlow {
    declare static readonly flowDef: IFlowDef<{
      item: number;
      events: string[];
    }>;

    @Task()
    static run(ctx: { item: number; events: string[] }) {
      ctx.events.push(`item:${ctx.item}`);
    }
  }

  @Flow<{ items: number[]; events: string[] }>("decorated-main")
  class DecoratedMainFlow {
    declare static readonly flowDef: IFlowDef<{
      items: number[];
      events: string[];
    }>;

    @Task()
    static start(ctx: { items: number[]; events: string[] }) {
      ctx.events.push("start");
    }

    @ChildFlow(builtChildFlow)
    static builtChild: void;

    @ForEach(
      (ctx: { items: number[]; events: string[] }) => ctx.items,
      DecoratedItemFlow,
    )
    static adaptItem(ctx: { items: number[]; events: string[] }, item: number) {
      return { item, events: ctx.events };
    }
  }

  const decoratedExecution = runtime.createFlowExecution(
    DecoratedMainFlow.flowDef,
    {
      items: [1, 2],
      events: [] as string[],
    },
  );

  await decoratedExecution.start();

  assert.deepEqual(decoratedExecution.context.events, [
    "start",
    "built-child",
    "item:1",
    "item:2",
  ]);

  const builderFlow = builder
    .flow<{ events: string[] }>("builder-uses-decorated")
    .childFlow(DecoratedItemFlow.flowDef, (ctx: { events: string[] }) => ({
      item: 99,
      events: ctx.events,
    }))
    .build();
  const builderExecution = runtime.createFlowExecution(builderFlow, {
    events: [] as string[],
  });

  await builderExecution.start();

  assert.deepEqual(builderExecution.context.events, ["item:99"]);
}

function testDecoratedSagaCompilesToSagaDef() {
  const compensateCharge = (ctx: { events: string[] }) => {
    ctx.events.push("undo-charge");
  };

  @Saga<{ events: string[] }>("decorated-saga")
  class DecoratedSagaFlow {
    declare static readonly flowDef: SagaDef<{ events: string[] }>;

    @Task()
    @CompensateWith(compensateCharge)
    static charge(ctx: { events: string[] }) {
      ctx.events.push("charge");
    }

    @Task()
    @CommitPoint()
    static confirm(ctx: { events: string[] }) {
      ctx.events.push("confirm");
    }
  }

  const saga = DecoratedSagaFlow.flowDef;

  assert.ok(saga instanceof SagaDef);
  assert.equal(
    saga.stepCompensationActionMap.get(saga.steps[0]!.id),
    compensateCharge,
  );
  assert.equal(saga.pivotStepId, saga.steps[1]?.id);
}

async function testDecoratedSagaRunsOnSagaRuntime() {
  const app = createSagaApp();
  const runtime = app.runtime();

  @Saga<{ events: string[] }>("decorated-saga-runtime")
  class DecoratedSagaRuntimeFlow {
    declare static readonly flowDef: SagaDef<{ events: string[] }>;

    @Task()
    @CompensateWith((ctx: { events: string[] }) => {
      ctx.events.push("compensate-charge");
    })
    static charge(ctx: { events: string[] }) {
      ctx.events.push("charge");
    }

    @Task()
    static fail() {
      throw new Error("decorated-saga-fail");
    }
  }

  const execution = asSagaExecution(
    runtime.createFlowExecution(DecoratedSagaRuntimeFlow.flowDef, {
      events: [] as string[],
    }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /decorated-saga-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.Compensated);
  assert.deepEqual((execution.context as { events: string[] }).events, [
    "charge",
    "compensate-charge",
  ]);
}

test(
  "decorated flows run on the existing runtime and interop with builder flows",
  testDecoratedFlowsRunOnExistingRuntimeAndInteropWithBuilder,
);
test("decorated saga compiles to SagaDef", testDecoratedSagaCompilesToSagaDef);
test("decorated saga runs on saga runtime", testDecoratedSagaRunsOnSagaRuntime);
