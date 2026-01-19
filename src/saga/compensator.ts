import { IFlowExecutionContext } from "../abstraction";
import { Compensation } from "./compensation";

export class Compensator<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> {
  protected compensations: Compensation<TContext>[] = [];

  registerCompensation(action: Compensation<TContext>) {
    this.compensations.push(action);
  }

  async compensate(context: TContext) {
    for (const action of this.compensations.toReversed()) {
      await action(context);
    }
  }
}
