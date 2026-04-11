# Recipes

## Run a Flow by ID with FlowRegistry

```ts
import { FlowRegistry, FlowWeave } from "flow-weave";

const app = FlowWeave.create().build();
const b = app.weaver();
const registry = new FlowRegistry();

const flow = b.flow<{ x: number }>("calc").task((ctx) => { ctx.x += 1; }).build();

registry.register(flow);

const resolved = registry.get("calc");

if (!resolved) throw new Error("Flow definition not found");

await app.runtime().createFlowExecution(resolved, { x: 0 }).start();
```

## Configure Execution Before Start

```ts
const execution = app.runtime().createFlowExecution(flow, { x: 0 });

execution.onFinished(() => {
  console.log("done", execution.getStatus());
});

await execution.start();
```

## Manually Control Start

```ts
const execution = app.runtime().createFlowExecution(flow, { x: 0 });

execution.requestStop();
await execution.start().catch(() => {});
```

## Reuse a Child Flow Across Branches

```ts
const child = b.flow<{ child: number }>().task(() => {}).build();

const parent = b
  .flow<{ value: number }>()
  .parallel()
  .branch(child, (ctx) => ({ child: ctx.value }))
  .branch(child, (ctx) => ({ child: ctx.value + 1 }))
  .join()
  .build();
```

## ParallelForEach with Adapt

```ts
const perItem = b
  .flow<{ id: string }>()
  .task((ctx) => console.log(ctx.id))
  .build();

const flow = b
  .flow<{ ids: string[] }>()
  .parallelForEach((ctx) => ctx.ids)
  .run(perItem, (_ctx, id) => ({ id }))
  .allSettled()
  .join()
  .build();
```
