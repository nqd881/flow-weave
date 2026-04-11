# Getting Started

## Requirements

- Node.js 18+ recommended
- TypeScript project

## Install

```bash
npm install flow-weave
```

## Create and Run a Flow

```ts
import { FlowWeave } from "flow-weave";

type Ctx = {
  value: number;
  logs: string[];
};

const app = FlowWeave.create().build();
const weaver = app.weaver();
const runtime = app.runtime();

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

await runtime
  .createFlowExecution(flow, {
    value: 0,
    logs: [],
  })
  .start();
```

## What Happens at Runtime

1. `app.runtime()` selects the execution factory by flow kind.
2. A `FlowExecution` is created with your context object.
3. Steps execute in order.
4. Execution status becomes `completed`, `failed`, or `stopped`.

## Enable Saga Plugin

```ts
import { FlowWeave, sagaPlugin } from "flow-weave";

const app = FlowWeave.create().use(sagaPlugin).build();

const saga = app
  .weaver()
  .saga<{ orderId: string }>("payment")
  .task(() => {})
  .build();
```

## Statuses

`FlowExecutionStatus` values:

- `pending`
- `running`
- `stopped`
- `completed`
- `failed`

## Running Through Runtime

```ts
const execution = app.runtime().createFlowExecution(flow, {
  value: 0,
  logs: [],
});

await execution.start();
```

Configure before start if needed:

```ts
execution.onFinished(() => {
  console.log(execution.getStatus());
});
```
