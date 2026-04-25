import { IFlowContext } from "../contracts";
import { FlowPlugin } from "../plugin";
import { SagaDefBuilder } from "./authoring/saga-def-builder";
import { SagaFlowRuntime } from "./runtime/saga-flow-runtime";
import { SagaDefMetadata } from "./saga-metadata";
import { SagaWeaverExtension } from "./authoring/saga-weaver-extension";

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
    builder.withFlowRuntime(new SagaFlowRuntime());
  },
};
