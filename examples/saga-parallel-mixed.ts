import {
  BuilderClient,
  Client,
  Compensation,
  IFlowExecutionContext,
} from "../src";

type Ctx = IFlowExecutionContext & {
  orderId: string;
  note: string;
  paymentApproved: boolean;
};

type ShipCtx = Ctx & { shipper: string };
type AuditCtx = Ctx & { auditId: string };

const client = new BuilderClient();

// Reused flow: audit trail (child context differs)
const auditFlow = client
  .newFlow<AuditCtx>()
  .task((ctx) => console.log("audit: log order", ctx.orderId, ctx.auditId))
  .task((ctx) => console.log("audit: note", ctx.note))
  .build();

// Inline flow factory: pack and ship (child context differs)
const packAndShipFactory = (c: BuilderClient) =>
  c
    .newFlow<ShipCtx>()
    .task((ctx) => console.log("pack", ctx.orderId))
    .task((ctx) => console.log("ship via", ctx.shipper))
    .build();

const releaseFunds: Compensation = async (ctx: unknown) => {
  const c = ctx as Ctx;
  console.log("payment: release funds", c.orderId);
};

const refundPayment: Compensation = async (ctx: unknown) => {
  const c = ctx as Ctx;
  console.log("payment: refund", c.orderId);
};

const rollbackFinalize: Compensation = async (ctx: unknown) => {
  const c = ctx as Ctx;
  console.log("parent: rollback finalize", c.orderId);
};

const paymentSaga = client
  .newSaga<Ctx>()
  .task((ctx) => {
    console.log("payment: reserve funds", ctx.orderId);
  })
  .compensateWith(releaseFunds)
  .task((ctx) => {
    console.log("payment: capture funds", ctx.orderId);
  })
  .compensateWith(refundPayment)
  .commit()
  .build();

const parentSaga = client
  .newSaga<Ctx>()
  .if(
    (ctx) => ctx.paymentApproved,
    (client) =>
      client
        .newFlow<Ctx>()
        .task((ctx) => console.log("approved, proceed", ctx.orderId))
        .build(),
    (client) =>
      client
        .newFlow<Ctx>()
        .task((ctx) => console.log("not approved, halt", ctx.orderId))
        .build(),
  )
  .parallel()
  // Inline flow from factory, adapt parent ctx to ship ctx
  .branch(packAndShipFactory, (parent) => ({ ...parent, shipper: "DHL" }))
  // Reused saga, same context
  .branch(paymentSaga)
  // Reused flow, adapt parent ctx to audit ctx
  .branch(auditFlow, (parent) => ({ ...parent, auditId: "AUD-999" }))
  .branch((client) =>
    client
      .newFlow<Ctx>()
      .task(() => console.log("xD"))
      .build(),
  )
  .allSettled()
  .join()
  .forEach(() => [1, 2, 3])
  .run(
    (client) => client.newFlow().build(),
    (_ctx, _item) => ({}),
  )
  .then()
  .parallelForEach((ctx: Ctx) => [1, 2, "3"])
  .run(
    (client: BuilderClient) =>
      client
        .newFlow()
        .task((_ctx) => {})
        .build(),
    (_ctx, _item) => {
      return {};
    },
  )
  .join()
  .build();

async function main() {
  const client = Client.defaultClient();

  await client
    .createFlowExecution(parentSaga, {
      orderId: "ORD-123",
      note: "priority",
      paymentApproved: true,
    } satisfies Ctx)
    .start();
}

main().catch((err) => {
  console.error(err);
});
