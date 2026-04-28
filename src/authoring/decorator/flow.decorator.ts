import { IFlowContext } from "../../contracts";
import { FlowDef, FlowDefMetadata } from "../../flow";
import { compileFlowDef } from "./compile";
import { WithFlowDef } from "./types";

/**
 * @Flow class decorator.
 * Compiles all decorated step members into a FlowDef and attaches it
 * as a static `flowDef` property on the class.
 */
export function Flow<TContext extends IFlowContext = IFlowContext>(
  id?: string,
  metadata?: FlowDefMetadata<TContext>,
) {
  return <TTarget extends abstract new (...args: any[]) => unknown>(
    target: TTarget,
    context: ClassDecoratorContext<TTarget>,
  ): WithFlowDef<TTarget, FlowDef<TContext>> => {
    const flowId = id ?? context.name ?? "unnamed-flow";
    const flowDef = compileFlowDef<TContext>(
      flowId,
      context.metadata,
      metadata,
      target,
    );

    Object.defineProperty(target, "flowDef", {
      value: flowDef,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return target as WithFlowDef<TTarget, FlowDef<TContext>>;
  };
}
