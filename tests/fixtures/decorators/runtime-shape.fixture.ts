import {
  IFlowDef,
  ParallelStepStrategy,
  StepDef,
  StepDefMetadata,
} from "../../../src";
import {
  Branch,
  Break,
  Case,
  Catch,
  ChildFlow,
  Default,
  Delay,
  Flow,
  ForEach,
  If,
  Parallel,
  ParallelForEach,
  PostHook,
  PreHook,
  Recover,
  Retry,
  StepId,
  Switch,
  Task,
  Try,
  While,
  createStepDecorator,
  createSubDecorator,
} from "../../../src/authoring/decorator";

export class GroupStepDef extends StepDef {
  constructor(
    public readonly labels: string[],
    metadata?: StepDefMetadata,
  ) {
    super(metadata);
  }
}

export const GroupLabel = createSubDecorator(
  "group-labels",
  (label: string) => label,
  "GroupLabel",
);

export const Group = createStepDecorator(
  (pending) =>
    (metadata) =>
      new GroupStepDef(
        [...(((pending["group-labels"] as string[] | undefined) ?? []))].reverse(),
        metadata,
      ),
  "Group",
);

export const preOne = () => undefined;
export const preTwo = () => undefined;
export const postOne = () => undefined;
export const postTwo = () => undefined;
export const recover = () => undefined;

@Flow<{ events: string[] }>("basic-flow")
export class BasicFlow {
  declare static readonly flowDef: IFlowDef<{ events: string[] }>;

  @Task()
  static first(ctx: { events: string[] }) {
    ctx.events.push("first");
  }

  @Delay(25)
  @StepId("delay-step")
  static wait: void;

  @Break()
  static stop: void;
}

@Flow<{ events: string[] }>("metadata-flow")
export class MetadataFlow {
  declare static readonly flowDef: IFlowDef<{ events: string[] }>;

  @Task()
  @StepId("process-step")
  @Retry({ maxAttempts: 3, backoff: "exponential" })
  @PreHook(preOne)
  @PreHook(preTwo)
  @PostHook(postOne)
  @PostHook(postTwo)
  @Recover(recover)
  static process() {}
}

@Flow("custom-group-flow")
export class CustomGroupFlow {
  declare static readonly flowDef: IFlowDef;

  @Group()
  @GroupLabel("first")
  @GroupLabel("second")
  static grouped: void;
}

@Flow<{ value: number; events: string[] }>("child-flow")
export class ChildFlowDef {
  declare static readonly flowDef: IFlowDef<{ value: number; events: string[] }>;

  @Task()
  static run(ctx: { value: number; events: string[] }) {
    ctx.events.push(`child:${ctx.value}`);
  }
}

@Flow<{ item: number; events: string[] }>("item-flow")
export class ItemFlowDef {
  declare static readonly flowDef: IFlowDef<{ item: number; events: string[] }>;

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
export class ControlFlow {
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

type RoutingCtx = {
  approved: boolean;
  payment: string;
  events: string[];
};

@Flow<RoutingCtx>("approved-flow")
export class ApprovedFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("rejected-flow")
export class RejectedFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("card-flow")
export class CardFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("fallback-flow")
export class FallbackFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("risky-flow")
export class RiskyFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("recovery-flow")
export class RecoveryFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @Task()
  static run() {}
}

@Flow<RoutingCtx>("routing-flow")
export class RoutingFlow {
  declare static readonly flowDef: IFlowDef<RoutingCtx>;

  @If((ctx: RoutingCtx) => ctx.approved, ApprovedFlow, RejectedFlow)
  static approval: void;

  @Switch((ctx: RoutingCtx) => ctx.payment)
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
