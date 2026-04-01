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
import { Client, FlowBuilderClient } from "flow-weave";

type Ctx = {
  value: number;
  logs: string[];
};

const builder = new FlowBuilderClient();

const flow = builder
  .newFlow<Ctx>("basic-flow")
  .task((ctx) => {
    ctx.value += 1;
    ctx.logs.push("increment");
  })
  .task(async (ctx) => {
    await Promise.resolve();
    ctx.logs.push(`value:${ctx.value}`);
  })
  .build();

const client = Client.defaultClient();

await client
  .createFlowExecution(flow, {
    value: 0,
    logs: [],
  })
  .start();
```

## What Happens at Runtime

1. `Client` selects the engine by flow kind.
2. A `FlowExecution` is created with your context object.
3. Steps execute in order.
4. Execution status becomes `completed`, `failed`, or `stopped`.

## Statuses

`FlowExecutionStatus` values:

- `pending`
- `running`
- `stopped`
- `completed`
- `failed`

## Running Through FlowManager

`FlowManager` is convenient when you want optional registry lookup and automatic start.

```ts
import { FlowManager } from "flow-weave";

const manager = new FlowManager();

await manager.run(flow, { value: 0, logs: [] });
```

`run` options:

- `kind`: enforce flow kind when resolving by id
- `configure`: mutate execution object before start
- `autoStart`: default `true`
