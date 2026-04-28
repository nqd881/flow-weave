import { BreakLoopStepDef } from "../../flow/step-defs";
import { createStepDecorator } from "./decorator-factories";

/**
 * @Break() — static field decorator.
 * Breaks the nearest enclosing while/forEach loop.
 */
export const Break = createStepDecorator(
  () => (metadata) => new BreakLoopStepDef(metadata),
  "Break",
);
