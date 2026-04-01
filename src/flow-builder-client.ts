import { IFlowExecutionContext } from "./abstraction";
import { FlowDefBuilder, FlowOptions } from "./base";
import { SagaDefBuilder } from "./saga";

export class FlowBuilderClient {
  newFlow<TContext extends IFlowExecutionContext = IFlowExecutionContext>(
    id?: string,
    options?: FlowOptions<TContext>,
  ) {
    return new FlowDefBuilder<typeof this, TContext>(this, id, options);
  }

  newSaga<TContext extends IFlowExecutionContext = IFlowExecutionContext>(
    id?: string,
    options?: FlowOptions<TContext>,
  ) {
    return new SagaDefBuilder<typeof this, TContext>(this, id, options);
  }
}
