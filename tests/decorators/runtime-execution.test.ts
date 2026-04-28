import assert from "assert/strict";
import { test } from "vitest";
import { SagaDef, SagaStatus } from "../../src/saga";
import { asSagaExecution } from "../helpers/assertions";
import { createCoreApp, createSagaApp } from "../helpers/app-helpers";
import { evaluateDecoratedFixture } from "../helpers/decorator-runtime-helpers";

const fixtureBasePath = "tests/fixtures/decorators";

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

  const { DecoratedItemFlow, DecoratedMainFlow } = evaluateDecoratedFixture<{
    DecoratedItemFlow: { flowDef: { steps: unknown[] } };
    DecoratedMainFlow: { flowDef: { steps: unknown[] } };
  }>(`${fixtureBasePath}/runtime-execution.fixture.ts`, { builtChildFlow });

  const decoratedExecution = runtime.createFlowExecution(DecoratedMainFlow.flowDef as any, {
    items: [1, 2],
    events: [] as string[],
  });

  await decoratedExecution.start();

  assert.deepEqual(
    (decoratedExecution.context as { events: string[] }).events,
    ["start", "built-child", "item:1", "item:2"],
  );

  const builderFlow = builder
    .flow<{ events: string[] }>("builder-uses-decorated")
    .childFlow(DecoratedItemFlow.flowDef as any, (ctx: { events: string[] }) => ({
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

async function testDecoratedSagaCompilesAndRunsOnSagaRuntime() {
  const app = createSagaApp();
  const runtime = app.runtime();

  const { DecoratedSagaFlow, DecoratedSagaRuntimeFlow, compensateCharge } =
    evaluateDecoratedFixture<{
      DecoratedSagaFlow: { flowDef: SagaDef<{ events: string[] }> };
      DecoratedSagaRuntimeFlow: { flowDef: SagaDef<{ events: string[] }> };
      compensateCharge: (context: { events: string[] }) => void;
    }>(`${fixtureBasePath}/runtime-saga.fixture.ts`);

  const saga = DecoratedSagaFlow.flowDef;

  assert.ok(saga instanceof SagaDef);
  assert.equal(saga.stepCompensationActionMap.get(saga.steps[0]!.id), compensateCharge);
  assert.equal(saga.pivotStepId, saga.steps[1]?.id);

  const execution = asSagaExecution(
    runtime.createFlowExecution(DecoratedSagaRuntimeFlow.flowDef, {
      events: [] as string[],
    }),
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /decorated-saga-fail/);

  assert.equal(execution.getSagaStatus(), SagaStatus.Compensated);
  assert.deepEqual(
    (execution.context as { events: string[] }).events,
    ["charge", "compensate-charge"],
  );
}

test("decorated flows run on the existing runtime and interop with builder flows", testDecoratedFlowsRunOnExistingRuntimeAndInteropWithBuilder);
test("decorated saga compiles and runs on the saga runtime", testDecoratedSagaCompilesAndRunsOnSagaRuntime);
