import assert from "assert/strict";
import { test } from "vitest";
import {
  FlowExecutionOutcomeKind,
  FlowNotFoundError,
  FlowRegistry,
  FlowWeave,
  FlowPlugin,
  WeaverBuilder,
  sagaPlugin,
} from "../../src";
import { FlowDef } from "../../src/flow";
import { createCoreApp, createSagaApp } from "../helpers/app-helpers";
import { assertFlowOutcome } from "../helpers/assertions";
import { TestCoreFlowRuntime } from "../helpers/runtime-helpers";

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

function testFlowWeaveAppExposesDefaultRegistry() {
  const app = createCoreApp();

  assert.ok(app.registry() instanceof FlowRegistry);
}

function testFlowWeaveAppCanSwapRegistryAfterBuild() {
  const app = createCoreApp();
  const originalRegistry = app.registry();
  const replacementRegistry = new FlowRegistry();
  const flow = app.weaver().flow("calc").task(() => undefined).build();

  originalRegistry.register(flow);
  app.setRegistry(replacementRegistry);

  assert.equal(app.registry(), replacementRegistry);
  assert.equal(app.resolveFlow("calc"), undefined);

  replacementRegistry.register(flow);
  assert.equal(app.resolveFlow("calc"), flow);
}

function testFlowWeaveAppRegisterFlowAndResolveFlow() {
  const app = createCoreApp();
  const flow = app.weaver().flow("calc").task(() => undefined).build();

  assert.equal(app.registerFlow(flow), flow);
  assert.equal(app.resolveFlow("calc"), flow);
}

async function testFlowWeaveAppRunFlowDef() {
  const app = createCoreApp();
  const flow = app
    .weaver()
    .flow<{ events: string[] }>("run-direct")
    .task((ctx) => {
      ctx.events.push("ran");
    })
    .build();

  const execution = await app.run(flow, { events: [] });

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual(execution.context.events, ["ran"]);
}

async function testFlowWeaveAppRunFlowById() {
  const app = createCoreApp();
  const flow = app
    .weaver()
    .flow<{ events: string[] }>("run-by-id")
    .task((ctx) => {
      ctx.events.push("ran-by-id");
    })
    .build();

  app.registerFlow(flow);

  const execution = await app.run("run-by-id", { events: [] }, FlowDef);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.deepEqual((execution.context as { events: string[] }).events, ["ran-by-id"]);
}

async function testFlowWeaveAppRunFlowByIdThrowsWhenMissing() {
  const app = createCoreApp();

  await assert.rejects(
    async () => {
      await app.run("missing-flow", {}, FlowDef);
    },
    (error: unknown) => error instanceof FlowNotFoundError,
  );
}

function testFlowWeaveBuilderSnapshotsRuntimeComponents() {
  class SnapshotFlowDef extends FlowDef {
    static readonly flowKind = SnapshotFlowDef;
  }

  class SnapshotFlowRuntime extends TestCoreFlowRuntime<SnapshotFlowDef> {
    readonly flowKind = SnapshotFlowDef;

    override clone() {
      return new SnapshotFlowRuntime(this.cloneStepExecutorRegistry());
    }
  }

  const snapshotPlugin: FlowPlugin = {
    id: "snapshot-runtime-plugin",
    installWeaver(builder) {
      return builder;
    },
    installRuntime(builder) {
      builder.withFlowRuntime(new SnapshotFlowRuntime());
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
    /Flow runtime not found/,
  );
}

test("FlowWeave core app does not expose saga", testFlowWeaveCoreAppDoesNotExposeSaga);
test("FlowWeave saga plugin exposes saga", testFlowWeaveSagaPluginExposesSaga);
test("WeaverBuilder supports plugins", testWeaverBuilderSupportsPlugins);
test("FlowWeave plugin dependencies are enforced", testFlowWeavePluginDependencies);
test("FlowWeaveApp exposes a default registry", testFlowWeaveAppExposesDefaultRegistry);
test("FlowWeaveApp can swap registry after build", testFlowWeaveAppCanSwapRegistryAfterBuild);
test("FlowWeaveApp can register and resolve flows", testFlowWeaveAppRegisterFlowAndResolveFlow);
test("FlowWeaveApp can run a flow definition directly", testFlowWeaveAppRunFlowDef);
test("FlowWeaveApp can run a flow by id", testFlowWeaveAppRunFlowById);
test("FlowWeaveApp throws when running a missing flow id", testFlowWeaveAppRunFlowByIdThrowsWhenMissing);
test("FlowWeave builder snapshots runtime components", testFlowWeaveBuilderSnapshotsRuntimeComponents);
test("Core runtime does not run saga by default", testCoreRuntimeDoesNotRunSagaByDefault);
