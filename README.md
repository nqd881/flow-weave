# flow-weave

`flow-weave` is a TypeScript workflow toolkit with one runtime model and two authoring styles:

- fluent builder authoring
- decorator authoring

It supports typed flow definitions, branching and iteration, runtime execution with stop propagation, and optional saga compensation.

## Installation

```bash
npm install flow-weave
```

## Package Entrypoints

- `flow-weave`: main app/runtime entry
- `flow-weave/builder`: advanced fluent-builder APIs
- `flow-weave/decorator`: core flow decorators
- `flow-weave/saga`: saga plugin, saga runtime/types, and saga decorators

Upgrading from the previous package surface? See the [v4 migration guide](https://github.com/nqd881/flow-weave/blob/main/docs/migrations/v4.md).

In normal app code, start with `FlowWeave` from the root package.

## Choose Your Style

### Builder

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

### Decorator

Decorator authoring uses TC39 Stage 3 decorators.

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

## Saga

Saga support is optional and lives in `flow-weave/saga`.

```ts
import { FlowWeave } from "flow-weave";
import { sagaPlugin } from "flow-weave/saga";

const app = FlowWeave.create().use(sagaPlugin).build();
```

Use `flow-weave/saga` for:

- `sagaPlugin`
- `SagaDef`, `SagaExecution`, saga status/types
- saga decorators like `@Saga`, `@CompensateWith`, and `@CommitPoint`

## What You Can Model

- task steps
- delay steps
- child-flow composition
- try/catch flow blocks
- parallel branches
- switch-style routing
- sequential and parallel iteration
- hooks, retry, and recovery
- saga compensation and commit points

## Documentation

- [Getting Started](https://github.com/nqd881/flow-weave/blob/main/docs/getting-started.md)
- [Migrate To v4](https://github.com/nqd881/flow-weave/blob/main/docs/migrations/v4.md)
- [Builder Guide](https://github.com/nqd881/flow-weave/blob/main/docs/builder.md)
- [Decorator Guide](https://github.com/nqd881/flow-weave/blob/main/docs/decorator.md)
- [Saga Guide](https://github.com/nqd881/flow-weave/blob/main/docs/saga.md)
- [Step Types](https://github.com/nqd881/flow-weave/blob/main/docs/step-types.md)
- [Hooks](https://github.com/nqd881/flow-weave/blob/main/docs/hooks.md)
- [Cancellation](https://github.com/nqd881/flow-weave/blob/main/docs/cancellation.md)
- [Extensibility](https://github.com/nqd881/flow-weave/blob/main/docs/extensibility.md)
- [Recipes](https://github.com/nqd881/flow-weave/blob/main/docs/recipes.md)
- [Troubleshooting](https://github.com/nqd881/flow-weave/blob/main/docs/troubleshooting.md)

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
