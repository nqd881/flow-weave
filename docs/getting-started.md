# Getting Started

## Install

```bash
npm install flow-weave
```

## Choose An Entrypoint

- `flow-weave`: main app/runtime entry
- `flow-weave/builder`: advanced fluent-builder APIs
- `flow-weave/decorator`: core flow decorators
- `flow-weave/saga`: saga plugin, saga runtime/types, and saga decorators

In normal app code, start with `FlowWeave` from the root package:

```ts
import { FlowWeave } from "flow-weave";
```

## Builder Quickstart

```ts
import { FlowWeave } from "flow-weave";

type Ctx = {
  value: number;
  logs: string[];
};

const app = FlowWeave.create().build();
const weaver = app.weaver();

const flow = weaver
  .flow<Ctx>("basic-flow")
  .task((ctx) => {
    ctx.value += 1;
    ctx.logs.push("increment");
  })
  .task(async (ctx) => {
    await Promise.resolve();
    ctx.logs.push(`value:${ctx.value}`);
  })
  .build();

await app.runtime().createFlowExecution(flow, {
  value: 0,
  logs: [],
}).start();
```

See [Builder Guide](./builder.md) for the fluent authoring model.

## Decorator Quickstart

```ts
import { FlowWeave, IFlowDef } from "flow-weave";
import { Flow, Task } from "flow-weave/decorator";

type Ctx = {
  value: number;
  logs: string[];
};

@Flow<Ctx>("basic-flow")
class BasicFlow {
  declare static readonly flowDef: IFlowDef<Ctx>;

  @Task()
  static increment(ctx: Ctx) {
    ctx.value += 1;
    ctx.logs.push("increment");
  }
}

const app = FlowWeave.create().build();

await app.runtime().createFlowExecution(BasicFlow.flowDef, {
  value: 0,
  logs: [],
}).start();
```

See [Decorator Guide](./decorator.md) for the decorator model and rules.

## Saga Quickstart

Saga support is optional.

```ts
import { FlowWeave } from "flow-weave";
import { sagaPlugin } from "flow-weave/saga";

const app = FlowWeave.create().use(sagaPlugin).build();
```

Use `flow-weave/saga` for all saga-specific APIs.
The root package does not export saga APIs.

See [Saga Guide](./saga.md) for builder-style and decorator-style saga examples.

## Runtime Model

At runtime:

1. `app.runtime()` selects a flow runtime by flow kind.
2. A `FlowExecution` is created with your context object.
3. Steps execute in order.
4. Execution finishes with outcome `completed`, `failed`, or `stopped`.

## Next Steps

- [Builder Guide](./builder.md)
- [Decorator Guide](./decorator.md)
- [Step Types](./step-types.md)
- [Hooks](./hooks.md)
- [Saga Guide](./saga.md)
