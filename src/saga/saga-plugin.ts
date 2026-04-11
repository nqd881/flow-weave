import { IFlowContext } from "../contracts";
import { FlowPlugin } from "../plugin";
import { SagaDefBuilder } from "./saga-def-builder";
import { SagaExecutionFactory } from "./saga-execution-factory";
import { SagaDefMetadata } from "./saga-metadata";
import { SagaWeaverExtension } from "./saga-weaver-extension";

export const sagaPlugin: FlowPlugin<SagaWeaverExtension> = {
  id: "saga",

  installWeaver(builder) {
    return builder.extendMethod("saga", (weaver) =>
      function <TContext extends IFlowContext = IFlowContext>(
        this: typeof weaver,
        id?: string,
        metadata?: SagaDefMetadata<TContext>,
      ) {
        return new SagaDefBuilder<typeof this, TContext>(this, id, metadata);
      },
    );
  },

  installRuntime(builder) {
    builder.withExecutionFactory(new SagaExecutionFactory());
  },
};
