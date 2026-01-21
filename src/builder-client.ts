import { IFlowExecutionContext } from "./abstraction";
import { FlowDefBuilder } from "./base";
import { SagaDefBuilder } from "./saga";

export class BuilderClient {
  newFlow<TContext extends IFlowExecutionContext = IFlowExecutionContext>(
    id?: string,
  ) {
    return new FlowDefBuilder<typeof this, TContext>(this, id);
  }

  newSaga<TContext extends IFlowExecutionContext = IFlowExecutionContext>(
    id?: string,
  ) {
    return new SagaDefBuilder<typeof this, TContext>(this, id);
  }
}
