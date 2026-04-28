import assert from "assert/strict";
import { test } from "vitest";
import { IFlowDef, TaskStepDef } from "../../src";
import {
  Flow,
  PostHook,
  PreHook,
  Recover,
  Retry,
  StepId,
  Task,
} from "../../src/authoring/decorator";

function testStepMetadataDecoratorsCombineInSourceOrder() {
  const preOne = () => undefined;
  const preTwo = () => undefined;
  const postOne = () => undefined;
  const postTwo = () => undefined;
  const recover = () => undefined;

  @Flow<{ events: string[] }>("step-metadata")
  class MetadataFlow {
    declare static readonly flowDef: IFlowDef<{ events: string[] }>;

    @Task()
    @StepId("process-step")
    @Retry({ maxAttempts: 3, backoff: "exponential" })
    @PreHook(preOne)
    @PreHook(preTwo)
    @PostHook(postOne)
    @PostHook(postTwo)
    @Recover(recover)
    static process(_ctx: { events: string[] }) {}
  }

  const step = MetadataFlow.flowDef.steps[0] as TaskStepDef<{
    events: string[];
  }>;

  assert.equal(step.id, "process-step");
  assert.equal(step.retry?.maxAttempts, 3);
  assert.equal(step.retry?.backoff, "exponential");
  assert.equal(step.recover, recover);
  assert.deepEqual(step.hooks?.pre, [preOne, preTwo]);
  assert.deepEqual(step.hooks?.post, [postOne, postTwo]);
}

function testDecoratorsRejectInstanceMembers() {
  assert.throws(() => {
    class InvalidDecoratorTarget {
      @Task()
      run() {}
    }

    return InvalidDecoratorTarget;
  }, /@Task can only be used on static class members\./);
}

test(
  "step metadata decorators combine in source order",
  testStepMetadataDecoratorsCombineInSourceOrder,
);
test("decorators reject instance members", testDecoratorsRejectInstanceMembers);
