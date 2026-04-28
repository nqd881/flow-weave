import { FlowWeave } from "../../src";
import { sagaPlugin } from "../../src/saga";

export function createCoreApp() {
  return FlowWeave.create().build();
}

export function createSagaApp() {
  return FlowWeave.create().use(sagaPlugin).build();
}
