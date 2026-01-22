import { FlowStoppedError } from "./flow-execution";
import { StepStoppedError } from "./step-execution";

/** Map flow stop errors to step stop errors. */
export function mapStop(err: unknown) {
  if (err instanceof FlowStoppedError) throw new StepStoppedError();
  throw err;
}

/**
 * Resolve when the first branch completes successfully.
 * If no branch succeeds (all fail/stop), resolve after all settle.
 */
export function firstCompleted(promises: Promise<any>[]) {
  let pending = promises.length;
  let resolved = false;

  return new Promise<void>((resolve) => {
    promises.forEach((p) =>
      p
        .then(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        })
        .catch(() => {
          pending -= 1;
          if (!resolved && pending === 0) {
            resolve();
          }
        }),
    );
  });
}
