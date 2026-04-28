# Recipes

This page collects small, practical patterns.

## Run A Flow By ID With The App Registry

```ts
import { FlowDef, FlowWeave } from "flow-weave";

const app = FlowWeave.create().build();
const builder = app.weaver();

const flow = builder
  .flow<{ x: number }>("calc")
  .task((ctx) => {
    ctx.x += 1;
  })
  .build();

app.registerFlow(flow);

await app.run("calc", { x: 0 }, FlowDef);
```

## Reuse A Child Flow Across Parallel Branches

```ts
const child = builder
  .flow<{ child: number }>()
  .task(() => {})
  .build();

const parent = builder
  .flow<{ value: number }>()
  .parallel()
  .branch(child, (ctx) => ({ child: ctx.value }))
  .branch(child, (ctx) => ({ child: ctx.value + 1 }))
  .join()
  .build();
```

## ParallelForEach With Adapt

```ts
const perItem = builder
  .flow<{ id: string }>()
  .task((ctx) => console.log(ctx.id))
  .build();

const flow = builder
  .flow<{ ids: string[] }>()
  .parallelForEach((ctx) => ctx.ids)
  .run(perItem, (_ctx, id) => ({ id }))
  .allSettled()
  .join()
  .build();
```

## Decorated Flow On The Existing Runtime

```ts
import { FlowWeave, IFlowDef } from "flow-weave";
import { Flow, Task } from "flow-weave/decorator";

type Ctx = { logs: string[] };

@Flow<Ctx>("decorated")
class DecoratedFlow {
  declare static readonly flowDef: IFlowDef<Ctx>;

  @Task()
  static run(ctx: Ctx) {
    ctx.logs.push("ran");
  }
}

const app = FlowWeave.create().build();
await app.runtime().createFlowExecution(DecoratedFlow.flowDef, { logs: [] }).start();
```

## Use A Decorated Flow Inside The Builder API

```ts
const flow = builder
  .flow<{ logs: string[] }>()
  .childFlow(DecoratedFlow.flowDef, (ctx) => ({ logs: ctx.logs }))
  .build();
```
