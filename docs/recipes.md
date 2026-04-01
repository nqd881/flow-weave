# Recipes

## Run a Flow by ID with FlowManager

```ts
import { FlowBuilderClient, FlowManager } from "flow-weave";

const b = new FlowBuilderClient();
const manager = new FlowManager();

const flow = b.newFlow<{ x: number }>("calc").task((ctx) => { ctx.x += 1; }).build();

manager.registry.register(flow);

await manager.run("calc", { x: 0 });
```

## Configure Execution Before Auto Start

```ts
await manager.run(flow, { x: 0 }, {
  configure(execution) {
    execution.onFinished(() => {
      console.log("done", execution.getStatus());
    });
  },
});
```

## Manually Control Start

```ts
const execution = await manager.run(flow, { x: 0 }, { autoStart: false });

execution.requestStop();
await execution.start().catch(() => {});
```

## Reuse a Child Flow Across Branches

```ts
const child = b.newFlow<{ child: number }>().task(() => {}).build();

const parent = b
  .newFlow<{ value: number }>()
  .parallel()
  .branch(child, (ctx) => ({ child: ctx.value }))
  .branch(child, (ctx) => ({ child: ctx.value + 1 }))
  .join()
  .build();
```

## ParallelForEach with Adapt

```ts
const perItem = b
  .newFlow<{ id: string }>()
  .task((ctx) => console.log(ctx.id))
  .build();

const flow = b
  .newFlow<{ ids: string[] }>()
  .parallelForEach((ctx) => ctx.ids)
  .run(perItem, (_ctx, id) => ({ id }))
  .allSettled()
  .join()
  .build();
```
