import { FlowWeave, sagaPlugin } from "../../src";

export function createCoreApp() {
  return FlowWeave.create().build();
}

export function createSagaApp() {
  return FlowWeave.create().use(sagaPlugin).build();
}
