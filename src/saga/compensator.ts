import { IFlowExecutionContext } from "../abstraction";
import { Compensation } from "./compensation";

export class Compensator<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> {
  protected compensations: Compensation<TContext>[] = [];

  registerCompensation(compensation: Compensation<TContext>) {
    this.compensations.push(compensation);
  }

  async compensate(context: TContext) {
    for (const compensation of this.compensations.toReversed()) {
      await Promise.resolve(compensation(context));
    }
  }
}
