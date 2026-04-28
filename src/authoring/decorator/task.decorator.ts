import { TaskStepDef } from "../../flow/step-defs";
import { createMethodStepDecorator } from "./decorator-factories";

/**
 * @Task() — static method decorator.
 * The method body becomes the task handler.
 */
export const Task = createMethodStepDecorator(
  (_pending, method) =>
    (metadata) =>
      new TaskStepDef(method as any, metadata),
  "Task",
);
