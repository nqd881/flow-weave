# flow-weave

`flow-weave` is a TypeScript workflow engine with a fluent builder API for regular flows and saga-style flows.

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
import { Client, FlowBuilderClient } from "flow-weave";

type Ctx = {
  orderId: string;
  approved: boolean;
  logs: string[];
};

const builder = new FlowBuilderClient();

const flow = builder
  .newFlow<Ctx>("order-flow")
  .task((ctx) => {
    ctx.logs.push(`start:${ctx.orderId}`);
  })
  .if(
    (ctx) => ctx.approved,
    (c) => c.newFlow<Ctx>().task((ctx) => ctx.logs.push("approved")).build(),
    (c) => c.newFlow<Ctx>().task((ctx) => ctx.logs.push("rejected")).build(),
  )
  .build();

const client = Client.defaultClient();

await client
  .createFlowExecution(flow, {
    orderId: "ORD-1",
    approved: true,
    logs: [],
  })
  .start();
```

## Core Concepts

- `FlowBuilderClient`: entrypoint for creating flow and saga definitions.
- `FlowDef`: built flow definition containing ordered steps.
- `Client`: runtime that resolves a suitable engine and creates executions.
- `FlowExecution`: stateful runtime object (`pending`, `running`, `completed`, `stopped`, `failed`).
- `SagaDef`: flow with compensation map and optional commit/pivot step.

## Main APIs

- Flow creation: `newFlow<TContext>(id?, options?)`
- Saga creation: `newSaga<TContext>(id?, options?)`
- Execution: `Client.defaultClient().createFlowExecution(flowDef, context).start()`
- Orchestration helper: `FlowManager.run(flowOrId, context, options)`

## Builder DSL Overview

- `step(id)` set id for next step
- `task(fn)` run task against current context
- `parallel(options?).branch(...).join()` run branches with a parallel strategy
- `while(condition, iterationFlow, adapt?, options?)` loop while condition is true
- `if(condition, trueFlow, elseFlow?, options?)` boolean switch convenience
- `switchOn(selector, options?).case(...).default(...).end()` value-based branch selection
- `forEach(selector, options?).run(...)` sequential item flow execution
- `parallelForEach(selector, options?).run(...).join()` parallel item flow execution

`task` and all non-task step creators accept step options with hooks:

```ts
.task(doCharge, {
  hooks: {
    pre: [validateCharge],
    post: [auditCharge],
  },
})
```

You can also define flow-level hooks once and apply them to each step execution:

```ts
const flow = builder.newFlow("order-flow", {
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
- reverse-order compensation on failed/stopped uncommitted execution

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

## Local Development

```bash
npm run typecheck
npm test
npm run build
npm run example
```
