import { IFlowContext } from "../../contracts";
import { DelayStepDef } from "../../flow/step-defs";
import { Selector } from "../../flow/types";
import { createStepDecorator } from "./decorator-factories";

/**
 * @Delay(durationOrSelector) — static field decorator.
 * Accepts a fixed number (ms) or a context selector.
 */
export const Delay = createStepDecorator(
  (
    _pending,
    durationOrSelector: number | Selector<IFlowContext, number>,
  ) => {
    const selector: Selector<IFlowContext, number> =
      typeof durationOrSelector === "number"
        ? () => durationOrSelector
        : durationOrSelector;

    return (metadata) => new DelayStepDef(selector, metadata);
  },
  "Delay",
);
