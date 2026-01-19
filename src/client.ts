import { IFlowDef, IFlowExecution, IFlowExecutionContext } from "./abstraction";
import { IClient } from "./abstraction/client";
import { FlowDefBuilder, IFlowBuilderClient } from "./base/flow-def-builder";
import { FlowExecution } from "./base/flow-execution";
import { FlowExecutor } from "./base/flow-executor";
import { SagaDef, SagaDefBuilder, SagaExecution, SagaExecutor } from "./saga";

export class Client implements IClient, IFlowBuilderClient {
  newFlow<
    TContext extends IFlowExecutionContext = IFlowExecutionContext
  >(): FlowDefBuilder<Client, TContext> {
    return new FlowDefBuilder<Client, TContext>(this);
  }

  newSaga<
    TContext extends IFlowExecutionContext = IFlowExecutionContext
  >(): SagaDefBuilder<Client, TContext> {
    return new SagaDefBuilder<Client, TContext>(this);
  }

  createFlowExecution<TContext extends IFlowExecutionContext>(
    flowDef: IFlowDef<TContext>,
    context: TContext
  ): IFlowExecution {
    if (flowDef instanceof SagaDef) {
      return new SagaExecution(this, new SagaExecutor(), flowDef, context);
    }

    return new FlowExecution(this, new FlowExecutor(), flowDef, context);
  }
}
