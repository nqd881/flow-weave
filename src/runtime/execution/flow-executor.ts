import {
  IFlowDef,
  IFlowExecution,
  IFlowExecutor,
} from "../../contracts";
import { StopSignal } from "../execution-signals";

export class FlowExecutor<
  TFlow extends IFlowDef,
> implements IFlowExecutor<TFlow> {
  async execute(flowExecution: IFlowExecution<TFlow>): Promise<any> {
    const { flowDef } = flowExecution;

    for (const stepDef of flowDef.steps) {
      if (flowExecution.isStopRequested()) throw new StopSignal();

      const stepExecution = flowExecution.createStepExecution(stepDef);

      await stepExecution.start();
    }
  }
}
