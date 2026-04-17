import {
  FlowExecutionFactory,
} from "./flow-execution-factory";
import {
  BreakLoopStepDef,
  ChildFlowStepDef,
  DelayStepDef,
  ForEachStepDef,
  ParallelForEachStepDef,
  ParallelStepDef,
  SwitchStepDef,
  TaskStepDef,
  TryCatchStepDef,
  WhileStepDef,
} from "./step-defs";
import {
  BreakLoopStepExecutor,
  ChildFlowStepExecutor,
  DelayStepExecutor,
  ForEachStepExecutor,
  ParallelForEachStepExecutor,
  ParallelStepExecutor,
  SwitchStepExecutor,
  TaskStepExecutor,
  TryCatchStepExecutor,
  WhileStepExecutor,
} from "./step-executors";
import { FlowExecutionFactoryRegistry } from "../runtime/flow-execution-factory-registry";
import { StepExecutorRegistry } from "../runtime/step-executor-registry";

export function registerBuiltInRuntimeComponents(
  flowExecutionFactoryRegistry: FlowExecutionFactoryRegistry,
  stepExecutorRegistry: StepExecutorRegistry,
) {
  flowExecutionFactoryRegistry.register(new FlowExecutionFactory());

  stepExecutorRegistry.register(TaskStepDef, () => new TaskStepExecutor());
  stepExecutorRegistry.register(BreakLoopStepDef, () => new BreakLoopStepExecutor());
  stepExecutorRegistry.register(DelayStepDef, () => new DelayStepExecutor());
  stepExecutorRegistry.register(ChildFlowStepDef, () => new ChildFlowStepExecutor());
  stepExecutorRegistry.register(TryCatchStepDef, () => new TryCatchStepExecutor());
  stepExecutorRegistry.register(ParallelStepDef, () => new ParallelStepExecutor());
  stepExecutorRegistry.register(WhileStepDef, () => new WhileStepExecutor());
  stepExecutorRegistry.register(SwitchStepDef, () => new SwitchStepExecutor());
  stepExecutorRegistry.register(ForEachStepDef, () => new ForEachStepExecutor());
  stepExecutorRegistry.register(ParallelForEachStepDef, () => new ParallelForEachStepExecutor());
}
