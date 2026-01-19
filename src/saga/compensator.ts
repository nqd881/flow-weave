import { IFlowExecutionContext } from "../abstraction";
import { Compensation } from "./compensation";

export class Compensator {
  protected compensations: Compensation[] = [];

  registerCompensation(action: Compensation) {
    this.compensations.push(action);
  }

  async compensate<
    TContext extends IFlowExecutionContext = IFlowExecutionContext
  >(context: TContext) {
    for (const action of this.compensations.toReversed()) {
      await action(context);
    }
  }
}
