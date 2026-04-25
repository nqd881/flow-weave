# Recipes

## Run a Flow by ID with App Registry

```ts
import { FlowDef, FlowWeave } from "flow-weave";

const app = FlowWeave.create().build();
const b = app.weaver();

const flow = b.flow<{ x: number }>("calc").task((ctx) => { ctx.x += 1; }).build();

app.registerFlow(flow);

await app.run("calc", { x: 0 }, FlowDef);
```

## Inspect Execution After Start

```ts
const execution = app.runtime().createFlowExecution(flow, { x: 0 });

await execution.start();
console.log("done", execution.getStatus());
```

## Manually Control Start

```ts
const execution = app.runtime().createFlowExecution(flow, { x: 0 });

execution.requestStop();
await execution.start().catch(() => {});
```

## Swap Registry After Build

```ts
import { FlowRegistry, FlowWeave } from "flow-weave";

const app = FlowWeave.create().build();

app.setRegistry(new FlowRegistry());
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
