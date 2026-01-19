import { FlowExecutionStatus, IFlowExecution } from "../abstraction";
import { FlowExecution } from "../base/flow-execution";
import { Compensation } from "./compensation";
import { Compensator } from "./compensator";
import { SagaDef } from "./saga-def";

export class SagaExecution<TFlowDef extends SagaDef = SagaDef>
  extends FlowExecution<TFlowDef>
  implements IFlowExecution
{
  protected committed = false;
  protected compensator = new Compensator();

  override init() {
    super.init();

    this.onFinished(async () => {
      if (this.isCommitted()) return;

      if (
        this.status === FlowExecutionStatus.Failed ||
        this.status === FlowExecutionStatus.Stopped
      ) {
        await Promise.resolve(this.compensator.compensate(this.context));
      }
    });
  }

  isCommitted() {
    return this.committed;
  }

  commit() {
    this.committed = true;
  }

  registerCompensation(action: Compensation) {
    this.compensator.registerCompensation(action);
  }
}
