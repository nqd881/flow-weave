import { FlowWeave } from "../src";

type OrderCtx = {
  orderId: string;
  approved: boolean;
  shippingLabel?: string;
  logs: string[];
};

const app = FlowWeave.create().build();
const weaver = app.weaver();
const runtime = app.runtime();

const orderFlow = weaver
  .flow<OrderCtx>("basic-order-flow")
  .task((ctx) => {
    ctx.logs.push(`received:${ctx.orderId}`);
    console.log("received order", ctx.orderId);
  })
  .if(
    (ctx) => ctx.approved,
    (nestedWeaver) =>
      nestedWeaver
        .flow<OrderCtx>()
        .task((ctx) => {
          ctx.shippingLabel = `SHIP-${ctx.orderId}`;
          ctx.logs.push("approved");
          console.log("approved order", ctx.orderId);
        })
        .build(),
    (nestedWeaver: typeof weaver) =>
      nestedWeaver
        .flow<OrderCtx>()
        .task((ctx) => {
          ctx.logs.push("rejected");
          console.log("rejected order", ctx.orderId);
        })
        .build(),
  )
  .task((ctx) => {
    ctx.logs.push(`finished:${ctx.orderId}`);
    console.log("flow finished", ctx.orderId);
  })
  .build();

async function main() {
  const execution = runtime.createFlowExecution(orderFlow, {
    orderId: "ORD-100",
    approved: true,
    logs: [],
  });

  await execution.start();

  console.log("final context", execution.context);
}

main().catch((error) => {
  console.error(error);
});
