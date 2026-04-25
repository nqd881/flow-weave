import assert from "assert/strict";
import { test } from "vitest";
import {
  FlowExecutionOutcomeKind,
  IStepExecutor,
  StepExecutionFailedOutcome,
  StepExecutionRecoveredOutcome,
  Runtime,
  StopSignal,
} from "../../src";
import { ChildFlowStepDef, FlowDef, StepDef, TaskStepDef } from "../../src/flow";
import { assertFlowOutcome } from "../helpers/assertions";
import { createConfiguredCoreRuntime } from "../helpers/runtime-helpers";

async function testStepRetrySucceedsAfterFailures() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("retry-success", [
      new TaskStepDef(
        (ctx: { events: string[] }) => {
          attempts += 1;
          ctx.events.push(`attempt:${attempts}`);

          if (attempts < 3) {
            throw new Error("retry-me");
          }
        },
        {
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    { events: [] },
  );

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(attempts, 3);
  assert.deepEqual(execution.context.events, [
    "attempt:1",
    "attempt:2",
    "attempt:3",
  ]);
}

async function testStepRetryFailsAfterExhaustion() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-fail", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("still-failing");
        },
        {
          retry: { maxAttempts: 2 },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /still-failing/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.equal(attempts, 2);
}

async function testStepRetryCanStopEarlyViaShouldRetry() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-should-stop-early", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("do-not-retry");
        },
        {
          retry: {
            maxAttempts: 5,
            shouldRetry: () => false,
          },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /do-not-retry/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.equal(attempts, 1);
}

async function testStepRetryStopsDuringBackoff() {
  const runtime = Runtime.default();

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-stop-backoff", [
      new TaskStepDef(
        () => {
          throw new Error("retry-stop");
        },
        {
          retry: {
            maxAttempts: 3,
            initialDelayMs: 50,
          },
        },
      ),
    ]),
    {},
  );

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

async function testStopSignalIsNotRetried() {
  class StoppingStepDef extends StepDef {
    constructor() {
      super({
        id: "stopping-step",
        retry: { maxAttempts: 3 },
      });
    }
  }

  let attempts = 0;

  class StoppingStepExecutor implements IStepExecutor<StoppingStepDef> {
    async execute() {
      attempts += 1;
      throw new StopSignal();
    }
  }

  const runtime = createConfiguredCoreRuntime((flowRuntime) => {
    flowRuntime.withStepExecutor(StoppingStepDef, () => new StoppingStepExecutor());
  });
  const execution = runtime.createFlowExecution(
    new FlowDef("stopping-step-flow", [new StoppingStepDef()]),
    {},
  );

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.equal(attempts, 1);
}

async function testStepRecoverRunsAfterRetriesAreExhausted() {
  const runtime = Runtime.default();
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef<{ events: string[] }>("retry-recover", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error("recover-me");
        },
        {
          retry: { maxAttempts: 2 },
          recover: (error, ctx) => {
            ctx.events.push(`recovered:${(error as Error).message}`);
          },
        },
      ),
      new TaskStepDef((ctx: { events: string[] }) => {
        ctx.events.push("after-recover");
      }),
    ]),
    { events: [] },
  );

  await execution.start();

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Completed);
  assert.equal(attempts, 2);
  assert.deepEqual(execution.context.events, [
    "recovered:recover-me",
    "after-recover",
  ]);
}

async function testPostHooksObserveRecoveredFinalStatus() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-recover-hooks", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error(`attempt-${attempts}`);
        },
        {
          hooks: {
            post: [(_ctx, info) => {
              assert.ok(info.outcome instanceof StepExecutionRecoveredOutcome);
              events.push(
                `${info.status}:${info.outcome.kind}:${(info.outcome.cause as Error).message}`,
              );
            }],
          },
          retry: { maxAttempts: 2 },
          recover: () => undefined,
        },
      ),
    ]),
    {},
  );

  await execution.start();

  assert.equal(attempts, 2);
  assert.deepEqual(events, ["running:recovered:attempt-2"]);
}

async function testRecoverDoesNotInterceptStopRequests() {
  class StoppingRecoverableStepDef extends StepDef {
    constructor() {
      super({
        id: "stopping-recoverable-step",
        retry: { maxAttempts: 3 },
        recover: () => {
          throw new Error("recover-should-not-run");
        },
      });
    }
  }

  let attempts = 0;

  class StoppingRecoverableStepExecutor
    implements IStepExecutor<StoppingRecoverableStepDef>
  {
    async execute() {
      attempts += 1;
      throw new StopSignal();
    }
  }

  const runtime = createConfiguredCoreRuntime((flowRuntime) => {
    flowRuntime.withStepExecutor(
      StoppingRecoverableStepDef,
      () => new StoppingRecoverableStepExecutor(),
    );
  });
  const execution = runtime.createFlowExecution(
    new FlowDef("stopping-recoverable-step-flow", [
      new StoppingRecoverableStepDef(),
    ]),
    {},
  );

  await assert.rejects(
    async () => {
      await execution.start();
    },
    (error: unknown) => error instanceof StopSignal,
  );

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Stopped);
  assert.equal(attempts, 1);
}

async function testRecoverThrowLeavesStepFailedWithReplacementError() {
  const runtime = Runtime.default();

  const execution = runtime.createFlowExecution(
    new FlowDef("recover-throws", [
      new TaskStepDef(
        () => {
          throw new Error("primary-failure");
        },
        {
          retry: { maxAttempts: 2 },
          recover: () => {
            throw new Error("recover-failure");
          },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /recover-failure/);

  assertFlowOutcome(execution, FlowExecutionOutcomeKind.Failed);
  assert.match(String(execution.getError()), /recover-failure/);
}

async function testHooksRunOncePerLogicalRetriedStep() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-hooks", [
      new TaskStepDef(
        () => {
          attempts += 1;

          if (attempts < 3) {
            throw new Error(`attempt-${attempts}`);
          }

          events.push(`task:${attempts}`);
        },
        {
          hooks: {
            pre: [() => events.push("pre")],
            post: [(_ctx, { status, outcome }) => {
              events.push(`post:${status}:${outcome?.kind}`);
            }],
          },
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    {},
  );

  await execution.start();

  assert.equal(attempts, 3);
  assert.deepEqual(events, ["pre", "task:3", "post:running:completed"]);
}

async function testPostHooksObserveFinalRetryFailureOnce() {
  const runtime = Runtime.default();
  const events: string[] = [];
  let attempts = 0;

  const execution = runtime.createFlowExecution(
    new FlowDef("retry-post-failure", [
      new TaskStepDef(
        () => {
          attempts += 1;
          throw new Error(`attempt-${attempts}`);
        },
        {
          hooks: {
            post: [(_ctx, { status, outcome }) => {
              assert.ok(outcome instanceof StepExecutionFailedOutcome);
              events.push(
                `post:${status}:${outcome.kind}:${(outcome.error as Error).message}`,
              );
            }],
          },
          retry: { maxAttempts: 3 },
        },
      ),
    ]),
    {},
  );

  await assert.rejects(async () => {
    await execution.start();
  }, /attempt-3/);

  assert.equal(attempts, 3);
  assert.deepEqual(events, ["post:running:failed:attempt-3"]);
}

async function testChildFlowRetryRerunsAgainstCurrentMutableContext() {
  const runtime = Runtime.default();

  const childFlow = new FlowDef<{ count: number; events: string[] }>(
    "child-retry-flow",
    [
      new TaskStepDef((ctx: { count: number; events: string[] }) => {
        ctx.count += 1;
        ctx.events.push(`child:${ctx.count}`);

        if (ctx.count === 1) {
          throw new Error("child-fail");
        }
      }),
    ],
  );

  const retryExecution = runtime.createFlowExecution(
    new FlowDef<{ count: number; events: string[] }>("parent-retry-flow", [
      new ChildFlowStepDef(childFlow, undefined, {
        retry: { maxAttempts: 2 },
      }),
    ]),
    { count: 0, events: [] },
  );

  await retryExecution.start();

  assertFlowOutcome(retryExecution, FlowExecutionOutcomeKind.Completed);
  assert.equal(retryExecution.context.count, 2);
  assert.deepEqual(retryExecution.context.events, ["child:1", "child:2"]);
}

test("step retry succeeds after failures", testStepRetrySucceedsAfterFailures);
test("step retry fails after exhaustion", testStepRetryFailsAfterExhaustion);
test("step retry can stop early via shouldRetry", testStepRetryCanStopEarlyViaShouldRetry);
test("step retry stops during backoff", testStepRetryStopsDuringBackoff);
test("stop signal is not retried", testStopSignalIsNotRetried);
test("step recover runs after retries are exhausted", testStepRecoverRunsAfterRetriesAreExhausted);
test("post hooks observe recovered final status", testPostHooksObserveRecoveredFinalStatus);
test("recover does not intercept stop requests", testRecoverDoesNotInterceptStopRequests);
test("recover throw leaves step failed with replacement error", testRecoverThrowLeavesStepFailedWithReplacementError);
test("hooks run once per logical retried step", testHooksRunOncePerLogicalRetriedStep);
test("post hooks observe final retry failure once", testPostHooksObserveFinalRetryFailureOnce);
test("child flow retry reruns against current mutable context", testChildFlowRetryRerunsAgainstCurrentMutableContext);
