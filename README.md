# flow-weave

`flow-weave` is a TypeScript workflow toolkit with a fluent authoring API for regular flows and saga-style flows.

It is designed for:

- typed flow definitions
- nested branching and iteration
- runtime execution with stop/cancel support
- saga compensation with commit points

## Installation

```bash
npm install flow-weave
```

## Quick Start

```ts
import { FlowWeave } from "flow-weave";

type Ctx = {
  orderId: string;
  approved: boolean;
  logs: string[];
};

const app = FlowWeave.create().build();
const weaver = app.weaver();
const runtime = app.runtime();

const flow = weaver
  .flow<Ctx>("order-flow")
  .task((ctx) => {
    ctx.logs.push(`start:${ctx.orderId}`);
  })
  .if(
    (ctx) => ctx.approved,
    (weaver) => weaver.flow<Ctx>().task((ctx) => ctx.logs.push("approved")).build(),
    (weaver) => weaver.flow<Ctx>().task((ctx) => ctx.logs.push("rejected")).build(),
  )
  .build();

await runtime
  .createFlowExecution(flow, {
    orderId: "ORD-1",
    approved: true,
    logs: [],
  })
  .start();
```

## Core Concepts

- `FlowWeave`: app builder entrypoint (`FlowWeave.create().build()`).
- `FlowWeaveApp`: holds both authoring (`weaver()`) and execution (`runtime()`).
- `Weaver`: core authoring API for flow definitions.
- `FlowDef`: built flow definition containing ordered steps.
- `Runtime`: execution runtime that resolves a suitable flow runtime and creates executions.
- `FlowExecution`: stateful runtime object with lifecycle status (`pending`, `running`, `finished`) and terminal outcome (`completed`, `stopped`, `failed`).
- `SagaDef`: saga flow with compensation map and optional commit/pivot step (via plugin).

## Main APIs

- App creation: `FlowWeave.create().use(...plugins).build()`
- Flow creation: `app.weaver().flow<TContext>(id?, options?)`
- Saga creation: `app.weaver().saga<TContext>(id?, options?)` (requires `sagaPlugin`)
- Execution: `app.runtime().createFlowExecution(flowDef, context).start()`
- App registry: `app.registry()`, `app.setRegistry(...)`, `app.registerFlow(...)`, `app.resolveFlow(...)`
- Run helper: `app.run(flowDef, context)` or `app.run(id, context, flowKind)`

## Built-in Plugins

`flow-weave` keeps core flow support built-in and provides saga as a first-party plugin.

```ts
import { FlowWeave, sagaPlugin } from "flow-weave";

const app = FlowWeave.create().use(sagaPlugin).build();

const saga = app
  .weaver()
  .saga<{ orderId: string }>("payment")
  .task(() => {})
  .build();
```

## Builder DSL Overview

- `step(id)` set id for next step
- `task(fn)` run task against current context
- `delay(ms | selector)` wait before continuing
- `childFlow(flow, adapt?)` run one child flow sequentially
- `try(flow, adapt?).catch(flow, adapt?).end()` recover a flow block with a catch flow
- `break()` break the nearest enclosing `while()` or `forEach()` loop
- `retry(policy)` retry the current logical step
- `recover(handler)` continue after final step failure
- `parallel().branch(...).join()` run branches with a parallel strategy
- `while(condition, iterationFlow, adapt?)` loop while condition is true
- `if(condition, trueFlow, elseFlow?)` boolean switch convenience
- `switchOn(selector).case(...).default(...).end()` value-based branch selection
- `forEach(selector).run(...)` sequential item flow execution
- `parallelForEach(selector).run(...).join()` parallel item flow execution

Use fluent step hooks on the current step builder state:

```ts
.task(doCharge)
.hooks({
  pre: [validateCharge],
  post: [auditCharge],
})
.retry({
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoff: "exponential",
})
.recover((error, ctx) => {
  ctx.logs.push(`recovered:${(error as Error).message}`);
})
```

You can also define flow-level hooks once and apply them to each step execution:

```ts
const flow = weaver.flow("order-flow", {
  hooks: {
    pre: [traceStepStart],
    post: [traceStepEnd],
  },
});
```

## Parallel Strategies

Use on `parallel()` and `parallelForEach()` builders:

- `allSettled()`
- `failFast()`
- `firstSettled()`
- `firstCompleted()`

## Cancellation Model

`flow-weave` uses a child-flow-focused cancellation contract:

- stop requests are primarily about child/branch execution behavior
- started child/branch flows receive `requestStop()` propagation
- no new child/branch flow should start after stop is acknowledged at start boundary
- selector/condition/adapt functions may still run depending on executor timing

See `docs/cancellation.md` for exact semantics and expected behavior by step type.

## Saga Model

Saga flow supports:

- `compensateWith(action)` to attach compensation for the previously added step
- `commit()` to define pivot/commit step
- reverse-order compensation on failed/stopped uncommitted execution outcomes

See `docs/saga.md` for details and examples.

## Documentation

- `docs/getting-started.md`
- `docs/flow-builder.md`
- `docs/step-types.md`
- `docs/hooks.md`
- `docs/saga.md`
- `docs/cancellation.md`
- `docs/extensibility.md`
- `docs/recipes.md`
- `docs/troubleshooting.md`

## Examples

- `npm run example:core` -> `examples/basic-flow.ts`
- `npm run example` or `npm run example:saga` -> `examples/checkout-saga.ts`
- `npm run example:advanced` -> `examples/branching-and-iteration.ts`

## Local Development

```bash
npm run typecheck
npm test
npm run build
npm run example:core
npm run example
npm run example:advanced
```
