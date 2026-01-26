/// <reference types="node" />
import assert from "assert/strict";
import {
  FlowBuilderClient,
  Client,
  FlowExecutionStatus,
  FlowStoppedError,
  ParallelStepStrategy,
} from "../src";
import { ParallelStepDef } from "../src/base";

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

async function main() {
  await testStopBeforeStart();
  testParallelBuilderStrategies();
  await testWhileLoopExecutesIterations();

  console.log("All tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
