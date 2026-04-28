# Step Types

This page describes the built-in step model in a style-neutral way.

For each step, the runtime behavior is the same whether you author it with the builder API or decorators.

## Task

- Purpose: run arbitrary logic against the current context
- Definition type: `TaskStepDef`
- Builder API: `.task(taskFn)`
- Decorator API: `@Task()` on a static method

## Delay

- Purpose: wait before continuing
- Definition type: `DelayStepDef`
- Builder API: `.delay(msOrSelector)`
- Decorator API: `@Delay(msOrSelector)` on a static field

Notes:

- accepts a fixed duration or selector
- stop cancels the active wait

## Child Flow

- Purpose: run one child flow sequentially
- Definition type: `ChildFlowStepDef`
- Builder API: `.childFlow(flow, adapt?)`
- Decorator API:
  - `@ChildFlow(flow)` on a static field
  - `@ChildFlow(flow)` on a static method where the method is the adapter

## Try / Catch

- Purpose: run one child flow and recover with another child flow when the try branch fails
- Definition type: `TryCatchStepDef`
- Builder API: `.try(flow, adapt?).catch(flow, adapt?).end()`
- Decorator API: `@Try(...)` with `@Catch(...)`

Notes:

- successful catch path completes the outer step
- stop bypasses the catch path
- outer retry reruns the whole try-catch block

## Parallel

- Purpose: run multiple branch flows concurrently
- Definition type: `ParallelStepDef`
- Builder API: `.parallel().branch(...).join()`
- Decorator API: `@Parallel(...)` with stacked `@Branch(...)`

Strategies:

- `all-settled`
- `fail-fast`
- `first-settled`
- `first-completed`

Non-`all-settled` strategies request stop on losing branches and wait for them to settle.

## While

- Purpose: repeat while a condition stays true
- Definition type: `WhileStepDef`
- Builder API: `.while(condition, iterationFlow, adapt?)`
- Decorator API:
  - `@While(condition, flow)` on a field
  - `@While(condition, flow)` on a method where the method is the adapter

## Switch

- Purpose: choose one branch by predicate or value
- Definition type: `SwitchStepDef`
- Builder API:
  - `.switchOn(selector)`
  - `.case(...)`
  - `.caseWhen(...)`
  - `.default(...)`
  - `.end()`
- Decorator API:
  - `@Switch(selector)`
  - `@Case(...)`
  - `@Default(...)`

Notes:

- first matching case wins
- if nothing matches and no default exists, no branch runs

## ForEach

- Purpose: run one child flow per item, sequentially
- Definition type: `ForEachStepDef`
- Builder API: `.forEach(selector).run(flow, adapt?)`
- Decorator API:
  - `@ForEach(selector, flow)` on a field
  - `@ForEach(selector, flow)` on a method where the method is the adapter

## ParallelForEach

- Purpose: run one child flow per item, in parallel
- Definition type: `ParallelForEachStepDef`
- Builder API: `.parallelForEach(selector).run(flow, adapt?).<strategy>().join()`
- Decorator API: `@ParallelForEach({ items, flow, strategy? })`

Strategies are the same as `parallel`.

## Break

- Purpose: exit the nearest enclosing `while` or `forEach` loop
- Definition type: `BreakLoopStepDef`
- Builder API: `.break()`
- Decorator API: `@Break()`

Notes:

- `break()` is structured loop control, not failure or cancellation
- it is consumed by the nearest `while` or `forEach`
- using it outside loop context rejects with `UncaughtBreakLoopError`
- using it inside `parallel` or `parallelForEach` is a modeling/runtime error

## Step Metadata

All step types support:

- hooks
- retry
- recover
- step ids

Builder style uses fluent methods after step declaration.
Decorator style uses metadata decorators like `@Retry(...)` and `@StepId(...)`.

See [Hooks](./hooks.md), [Builder Guide](./builder.md), and [Decorator Guide](./decorator.md).
