import { StepExecutorRegistry } from "../step-executor-registry";
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
} from "../../flow/step-defs";
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

export function registerBuiltInStepExecutors(registry: StepExecutorRegistry) {
  registry.register(TaskStepDef, () => new TaskStepExecutor());
  registry.register(BreakLoopStepDef, () => new BreakLoopStepExecutor());
  registry.register(DelayStepDef, () => new DelayStepExecutor());
  registry.register(ChildFlowStepDef, () => new ChildFlowStepExecutor());
  registry.register(TryCatchStepDef, () => new TryCatchStepExecutor());
  registry.register(ParallelStepDef, () => new ParallelStepExecutor());
  registry.register(WhileStepDef, () => new WhileStepExecutor());
  registry.register(SwitchStepDef, () => new SwitchStepExecutor());
  registry.register(ForEachStepDef, () => new ForEachStepExecutor());
  registry.register(ParallelForEachStepDef, () => new ParallelForEachStepExecutor());
}
