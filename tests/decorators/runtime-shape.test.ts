import assert from "assert/strict";
import { test } from "vitest";
import {
  BreakLoopStepDef,
  ChildFlowStepDef,
  DelayStepDef,
  ForEachStepDef,
  ParallelForEachStepDef,
  ParallelStepDef,
  ParallelStepStrategy,
  SwitchStepDef,
  TaskStepDef,
  TryCatchStepDef,
  WhileStepDef,
} from "../../src";
import { evaluateDecoratedFixture } from "../helpers/decorator-runtime-helpers";

const fixtureBasePath = "tests/fixtures/decorators";

function testDecoratedFlowsCompileToExpectedStepDefs() {
  const {
    BasicFlow,
    MetadataFlow,
    CustomGroupFlow,
    GroupStepDef,
    preOne,
    preTwo,
    postOne,
    postTwo,
    recover,
    ControlFlow,
    RoutingFlow,
  } = evaluateDecoratedFixture<{
    BasicFlow: { flowDef: { id: string; steps: unknown[] } };
    MetadataFlow: { flowDef: { steps: unknown[] } };
    CustomGroupFlow: { flowDef: { steps: unknown[] } };
    GroupStepDef: new (...args: any[]) => { labels: string[] };
    preOne: Function;
    preTwo: Function;
    postOne: Function;
    postTwo: Function;
    recover: Function;
    ControlFlow: { flowDef: { steps: unknown[] } };
    RoutingFlow: { flowDef: { steps: unknown[] } };
  }>(`${fixtureBasePath}/runtime-shape.fixture.ts`);

  assert.equal(BasicFlow.flowDef.id, "basic-flow");
  assert.ok(BasicFlow.flowDef.steps[0] instanceof TaskStepDef);
  assert.ok(BasicFlow.flowDef.steps[1] instanceof DelayStepDef);
  assert.ok(BasicFlow.flowDef.steps[2] instanceof BreakLoopStepDef);
  assert.equal((BasicFlow.flowDef.steps[1] as DelayStepDef).id, "delay-step");

  const metadataStep = MetadataFlow.flowDef.steps[0] as TaskStepDef;
  assert.equal(metadataStep.id, "process-step");
  assert.equal(metadataStep.retry?.maxAttempts, 3);
  assert.equal(metadataStep.retry?.backoff, "exponential");
  assert.equal(metadataStep.recover, recover);
  assert.deepEqual(metadataStep.hooks?.pre, [preOne, preTwo]);
  assert.deepEqual(metadataStep.hooks?.post, [postOne, postTwo]);

  const groupStep = CustomGroupFlow.flowDef.steps[0] as InstanceType<typeof GroupStepDef>;
  assert.ok(groupStep instanceof GroupStepDef);
  assert.deepEqual([...groupStep.labels], ["first", "second"]);

  const [childStep, eachStep, parallelEachStep, whileStep] = ControlFlow.flowDef.steps as [
    ChildFlowStepDef,
    ForEachStepDef,
    ParallelForEachStepDef,
    WhileStepDef,
  ];
  const loopContext = {
    value: 2,
    items: [1, 2],
    keepRunning: true,
    events: [] as string[],
  };

  assert.equal(childStep.childFlow.id, "child-flow");
  assert.deepEqual(
    { ...(childStep.adapt?.(loopContext) as Record<string, unknown>) },
    { value: 2, events: loopContext.events },
  );
  assert.equal(eachStep.itemFlow.id, "item-flow");
  assert.deepEqual(
    { ...(eachStep.adapt?.(loopContext, 4) as Record<string, unknown>) },
    { item: 4, events: loopContext.events },
  );
  assert.equal(parallelEachStep.itemFlow.id, "item-flow");
  assert.equal(parallelEachStep.strategy, ParallelStepStrategy.FirstCompleted);
  assert.equal(whileStep.iterationFlow.id, "child-flow");

  const [ifStep, switchStep, tryStep, parallelStep] = RoutingFlow.flowDef.steps as [
    SwitchStepDef,
    SwitchStepDef,
    TryCatchStepDef,
    ParallelStepDef,
  ];

  assert.ok(ifStep instanceof SwitchStepDef);
  assert.equal(ifStep.cases[0]?.flow.id, "approved-flow");
  assert.equal(ifStep.defaultBranch?.flow.id, "rejected-flow");
  assert.equal(switchStep.cases[0]?.flow.id, "card-flow");
  assert.equal(switchStep.defaultBranch?.flow.id, "fallback-flow");
  assert.equal(tryStep.tryBranch.flow.id, "risky-flow");
  assert.equal(tryStep.catchBranch.flow.id, "recovery-flow");
  assert.equal(parallelStep.strategy, ParallelStepStrategy.FailFast);
  assert.deepEqual(
    parallelStep.branches.map((branch) => branch.flow.id),
    ["approved-flow", "rejected-flow"],
  );
}

function testDecoratorValidationMatchesBuilderBehavior() {
  assert.throws(
    () => {
      evaluateDecoratedFixture(`${fixtureBasePath}/invalid-parallel.fixture.ts`);
    },
    /Parallel step must have at least one branch\./,
  );

  assert.throws(
    () => {
      evaluateDecoratedFixture(`${fixtureBasePath}/invalid-switch.fixture.ts`);
    },
    /Switch step must have at least one branch\./,
  );

  assert.throws(
    () => {
      evaluateDecoratedFixture(`${fixtureBasePath}/invalid-try.fixture.ts`);
    },
    /Try step must have a catch branch\./,
  );

  assert.throws(
    () => {
      evaluateDecoratedFixture(`${fixtureBasePath}/invalid-child.fixture.ts`);
    },
    /Flow reference must be an IFlowDef or a class decorated with @Flow or @Saga\./,
  );

  assert.throws(
    () => {
      evaluateDecoratedFixture(`${fixtureBasePath}/invalid-instance-task.fixture.ts`);
    },
    /@Task can only be used on static class members\./,
  );
}

test("decorated flows compile to the expected step defs", testDecoratedFlowsCompileToExpectedStepDefs);
test("decorator validation matches builder behavior", testDecoratorValidationMatchesBuilderBehavior);
