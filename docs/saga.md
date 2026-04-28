# Saga Guide

Saga support is optional and lives in `flow-weave/saga`.

## Imports

```ts
import { FlowWeave } from "flow-weave";
import { sagaPlugin } from "flow-weave/saga";
```

Decorator-style saga APIs also come from `flow-weave/saga`:

```ts
import { Saga, CompensateWith, CommitPoint } from "flow-weave/saga";
import { Task } from "flow-weave/decorator";
```

The root package does not export saga APIs.

## Runtime Requirement

Saga definitions need the saga plugin installed before execution.

```ts
const app = FlowWeave.create().use(sagaPlugin).build();
```

The plugin does two things:

- adds `weaver().saga(...)` to the builder surface
- registers saga runtime support so `SagaDef` can execute

## Builder-Style Saga

```ts
import {
  CompensatorStrategy,
  StepCompensationAction,
  sagaPlugin,
} from "flow-weave/saga";

type Ctx = { orderId: string };

const app = FlowWeave.create().use(sagaPlugin).build();
const weaver = app.weaver();

const releaseFunds: StepCompensationAction<Ctx> = async (ctx) => {
  console.log("release", ctx.orderId);
};

const saga = weaver
  .saga<Ctx>("payment-saga", {
    compensatorStrategy: CompensatorStrategy.BestEffort,
  })
  .step("reserve")
  .task(() => {})
  .compensateWith(releaseFunds)
  .commit()
  .build();
```

## Decorator-Style Saga

```ts
import { Task } from "flow-weave/decorator";
import { CommitPoint, CompensateWith, Saga, SagaDef } from "flow-weave/saga";

type Ctx = { events: string[] };

@Saga<Ctx>("checkout-saga")
class CheckoutSaga {
  declare static readonly flowDef: SagaDef<Ctx>;

  @Task()
  @CompensateWith((ctx: Ctx) => {
    ctx.events.push("undo-charge");
  })
  static charge(ctx: Ctx) {
    ctx.events.push("charge");
  }

  @Task()
  @CommitPoint()
  static confirm(ctx: Ctx) {
    ctx.events.push("confirm");
  }
}
```

## Compensation

- compensation attaches to a completed step
- builder style uses `.compensateWith(action)`
- decorator style uses `@CompensateWith(action)`
- compensations run in reverse registration order
- recovered steps do not register compensation by default

## Commit / Pivot Step

- builder style uses `.commit()`
- decorator style uses `@CommitPoint()`
- before commit, completed steps may register compensation
- after commit, later steps do not register compensation

## When Compensation Runs

Compensation runs when saga execution ends with:

- `failed`
- `stopped`

and the saga is not committed.

## Runtime Pieces

- `SagaDef`
- `SagaExecution`
- `SagaFlowRuntime`
- `sagaPlugin`

Use `flow-weave/saga` whenever you need saga runtime/types or saga-specific authoring.
