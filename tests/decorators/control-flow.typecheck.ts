import assert from "assert/strict";
import { test } from "vitest";
import {
  ChildFlowStepDef,
  ForEachStepDef,
  IFlowDef,
  ParallelForEachStepDef,
  ParallelStepDef,
  ParallelStepStrategy,
  SwitchStepDef,
  TryCatchStepDef,
  WhileStepDef,
} from "../../src";
import {
  Branch,
  Case,
  Catch,
  ChildFlow,
  Default,
  Flow,
  ForEach,
  If,
  Parallel,
  ParallelForEach,
  Switch,
  Task,
  Try,
  While,
} from "../../src/authoring/decorator";

function testChildAndLoopDecoratorsCompileWithMethodAdapters() {
  @Flow<{ value: number; events: string[] }>("child-flow")
  class ChildFlowDef {
    declare static readonly flowDef: IFlowDef<{
      value: number;
      events: string[];
    }>;

    @Task()
    static run(ctx: { value: number; events: string[] }) {
      ctx.events.push(`child:${ctx.value}`);
    }
  }

  @Flow<{ item: number; events: string[] }>("item-flow")
  class ItemFlowDef {
    declare static readonly flowDef: IFlowDef<{
      item: number;
      events: string[];
    }>;

    @Task()
    static run(ctx: { item: number; events: string[] }) {
      ctx.events.push(`item:${ctx.item}`);
    }
  }

  @Flow<{
    value: number;
    items: number[];
    keepRunning: boolean;
    events: string[];
  }>("control-flow")
  class ControlFlow {
    declare static readonly flowDef: IFlowDef<{
      value: number;
      items: number[];
      keepRunning: boolean;
      events: string[];
    }>;

    @ChildFlow(ChildFlowDef)
    static adaptChild(ctx: {
      value: number;
      items: number[];
      keepRunning: boolean;
      events: string[];
    }) {
      return { value: ctx.value, events: ctx.events };
    }

    @ForEach(
      (ctx: {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      }) => ctx.items,
      ItemFlowDef,
    )
    static adaptEach(
      ctx: {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      item: number,
    ) {
      return { item, events: ctx.events };
    }

    @ParallelForEach({
      items: (ctx: {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      }) => ctx.items,
      flow: ItemFlowDef,
      strategy: ParallelStepStrategy.FirstCompleted,
    })
    static adaptParallel(
      ctx: {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      item: number,
    ) {
      return { item, events: ctx.events };
    }

    @While(
      (ctx: {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      }) => ctx.keepRunning,
      ChildFlowDef,
    )
    static adaptLoop(ctx: {
      value: number;
      items: number[];
      keepRunning: boolean;
      events: string[];
    }) {
      return { value: ctx.value, events: ctx.events };
    }
  }

  const [childStep, eachStep, parallelEachStep, whileStep] = ControlFlow.flowDef
    .steps as [
    ChildFlowStepDef<
      {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      { value: number; events: string[] }
    >,
    ForEachStepDef<
      {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      { item: number; events: string[] },
      number
    >,
    ParallelForEachStepDef<
      {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      { item: number; events: string[] },
      number
    >,
    WhileStepDef<
      {
        value: number;
        items: number[];
        keepRunning: boolean;
        events: string[];
      },
      { value: number; events: string[] }
    >,
  ];

  const context = {
    value: 2,
    items: [1, 2],
    keepRunning: true,
    events: [] as string[],
  };

  assert.equal(childStep.childFlow.id, "child-flow");
  assert.deepEqual(childStep.adapt?.(context), {
    value: 2,
    events: context.events,
  });
  assert.equal(eachStep.itemFlow.id, "item-flow");
  assert.deepEqual(eachStep.adapt?.(context, 4), {
    item: 4,
    events: context.events,
  });
  assert.equal(parallelEachStep.itemFlow.id, "item-flow");
  assert.equal(parallelEachStep.strategy, ParallelStepStrategy.FirstCompleted);
  assert.deepEqual(parallelEachStep.adapt?.(context, 5), {
    item: 5,
    events: context.events,
  });
  assert.equal(whileStep.iterationFlow.id, "child-flow");
  assert.deepEqual(whileStep.adapt?.(context), {
    value: 2,
    events: context.events,
  });
}

async function testBranchSwitchIfAndTryDecoratorsCompile() {
  @Flow<{ approved: boolean; payment: string; events: string[] }>(
    "approved-flow",
  )
  class ApprovedFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>(
    "rejected-flow",
  )
  class RejectedFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>("card-flow")
  class CardFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>(
    "fallback-flow",
  )
  class FallbackFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>("risky-flow")
  class RiskyFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>(
    "recovery-flow",
  )
  class RecoveryFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @Task()
    static run(_ctx: {
      approved: boolean;
      payment: string;
      events: string[];
    }) {}
  }

  @Flow<{ approved: boolean; payment: string; events: string[] }>(
    "routing-flow",
  )
  class RoutingFlow {
    declare static readonly flowDef: IFlowDef<{
      approved: boolean;
      payment: string;
      events: string[];
    }>;

    @If(
      (ctx: { approved: boolean; payment: string; events: string[] }) =>
        ctx.approved,
      ApprovedFlow,
      RejectedFlow,
    )
    static approval: void;

    @Switch(
      (ctx: { approved: boolean; payment: string; events: string[] }) =>
        ctx.payment,
    )
    @Case("card", CardFlow)
    @Default(FallbackFlow)
    static route: void;

    @Try(RiskyFlow)
    @Catch(RecoveryFlow)
    static safe: void;

    @Parallel({ strategy: ParallelStepStrategy.FailFast })
    @Branch(ApprovedFlow)
    @Branch(RejectedFlow)
    static split: void;
  }

  const [ifStep, switchStep, tryStep, parallelStep] = RoutingFlow.flowDef
    .steps as [
    SwitchStepDef<
      { approved: boolean; payment: string; events: string[] },
      boolean
    >,
    SwitchStepDef<
      { approved: boolean; payment: string; events: string[] },
      string
    >,
    TryCatchStepDef<{ approved: boolean; payment: string; events: string[] }>,
    ParallelStepDef<{ approved: boolean; payment: string; events: string[] }>,
  ];

  assert.ok(ifStep instanceof SwitchStepDef);
  assert.equal(ifStep.cases.length, 1);
  assert.equal(ifStep.cases[0]?.flow.id, "approved-flow");
  assert.equal(ifStep.defaultBranch?.flow.id, "rejected-flow");

  assert.ok(switchStep instanceof SwitchStepDef);
  assert.equal(switchStep.cases.length, 1);
  assert.equal(
    await switchStep.cases[0]!.predicate("card", {
      approved: true,
      payment: "card",
      events: [],
    }),
    true,
  );
  assert.equal(
    await switchStep.cases[0]!.predicate("cash", {
      approved: true,
      payment: "cash",
      events: [],
    }),
    false,
  );
  assert.equal(switchStep.defaultBranch?.flow.id, "fallback-flow");

  assert.ok(tryStep instanceof TryCatchStepDef);
  assert.equal(tryStep.tryBranch.flow.id, "risky-flow");
  assert.equal(tryStep.catchBranch.flow.id, "recovery-flow");

  assert.ok(parallelStep instanceof ParallelStepDef);
  assert.equal(parallelStep.strategy, ParallelStepStrategy.FailFast);
  assert.deepEqual(
    parallelStep.branches.map((branch) => branch.flow.id),
    ["approved-flow", "rejected-flow"],
  );
}

function testControlFlowDecoratorsMatchBuilderValidation() {
  assert.throws(() => {
    @Flow("invalid-parallel")
    class InvalidParallelFlow {
      @Parallel()
      static broken: void;
    }

    return InvalidParallelFlow;
  }, /Parallel step must have at least one branch\./);

  assert.throws(() => {
    @Flow("invalid-switch")
    class InvalidSwitchFlow {
      @Switch((_ctx: { kind: string }) => _ctx.kind)
      static broken: void;
    }

    return InvalidSwitchFlow;
  }, /Switch step must have at least one branch\./);

  assert.throws(() => {
    @Flow<{ events: string[] }>("valid-try-flow")
    class ValidTryFlow {
      declare static readonly flowDef: IFlowDef<{ events: string[] }>;

      @Task()
      static run(_ctx: { events: string[] }) {}
    }

    @Flow<{ events: string[] }>("invalid-try")
    class InvalidTryFlow {
      declare static readonly flowDef: IFlowDef<{ events: string[] }>;

      @Try(ValidTryFlow)
      static broken: void;
    }

    return InvalidTryFlow;
  }, /Try step must have a catch branch\./);
}

test(
  "child and loop decorators compile with method adapters",
  testChildAndLoopDecoratorsCompileWithMethodAdapters,
);
test(
  "branch, switch, if, and try decorators compile",
  testBranchSwitchIfAndTryDecoratorsCompile,
);
test(
  "control-flow decorators match builder validation",
  testControlFlowDecoratorsMatchBuilderValidation,
);
