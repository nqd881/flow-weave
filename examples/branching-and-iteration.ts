import { FlowWeave } from "../src";

type BatchCtx = {
  orderId: string;
  priority: boolean;
  itemIds: number[];
  packed: number[];
  audited: number[];
  logs: string[];
};

const app = FlowWeave.create().build();
const weaver = app.weaver();
const runtime = app.runtime();

const invoiceFlow = weaver
  .flow<{ orderId: string; logs: string[] }>("invoice-flow")
  .task((ctx) => {
    ctx.logs.push(`invoice:${ctx.orderId}`);
    console.log("create invoice", ctx.orderId);
  })
  .build();

const advancedFlow = weaver
  .flow<BatchCtx>("branching-and-iteration")
  .task((ctx) => {
    ctx.logs.push(`start:${ctx.orderId}`);
  })
  .if(
    (ctx) => ctx.priority,
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<BatchCtx>()
        .task((ctx) => {
          ctx.logs.push("route:priority");
          console.log("priority route", ctx.orderId);
        })
        .build(),
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<BatchCtx>()
        .task((ctx) => {
          ctx.logs.push("route:standard");
          console.log("standard route", ctx.orderId);
        })
        .build(),
  )
  .parallel()
  .branch(invoiceFlow, (ctx) => ({ orderId: ctx.orderId, logs: ctx.logs }))
  .branch(
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<{ orderId: string; logs: string[] }>("warehouse-flow")
        .task((ctx) => {
          ctx.logs.push(`warehouse:${ctx.orderId}`);
          console.log("notify warehouse", ctx.orderId);
        })
        .build(),
    (ctx) => ({ orderId: ctx.orderId, logs: ctx.logs }),
  )
  .allSettled()
  .join()
  .forEach((ctx) => ctx.itemIds)
  .run(
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<{ itemId: number; packed: number[]; logs: string[] }>("pick-item")
        .task((ctx) => {
          ctx.logs.push(`pick:${ctx.itemId}`);
          ctx.packed.push(ctx.itemId);
          console.log("pick item", ctx.itemId);
        })
        .build(),
    (ctx, item) => ({ itemId: item, packed: ctx.packed, logs: ctx.logs }),
  )
  .parallelForEach((ctx) => ctx.itemIds)
  .run(
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<{ itemId: number; audited: number[]; logs: string[] }>("audit-item")
        .task((ctx) => {
          ctx.logs.push(`audit:${ctx.itemId}`);
          ctx.audited.push(ctx.itemId);
          console.log("audit item", ctx.itemId);
        })
        .build(),
    (ctx, item) => ({ itemId: item, audited: ctx.audited, logs: ctx.logs }),
  )
  .join()
  .task((ctx) => {
    ctx.logs.push(`finished:${ctx.orderId}`);
  })
  .build();

async function main() {
  const execution = runtime.createFlowExecution(advancedFlow, {
    orderId: "ORD-300",
    priority: true,
    itemIds: [1, 2, 3],
    packed: [],
    audited: [],
    logs: [],
  });

  await execution.start();

  console.log("final context", execution.context);
}

main().catch((error) => {
  console.error(error);
});
