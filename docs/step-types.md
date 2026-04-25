# Step Types

This page explains each built-in step definition and its intent.

All step types support optional step hooks through fluent builder hook methods:

- `hooks.pre[]`
- `hooks.post[]`
- `retry(...)`
- `recover(...)`

Hooks are step-level lifecycle hooks (not per-branch/per-item hooks).
Retry re-runs the logical step executor against the current mutable context.
Recover converts a final failed step into a `recovered` outcome so the flow can continue.

## Task Step

- Purpose: run arbitrary logic against current context.
- Type: `TaskStepDef`.
- Builder API: `.task(taskFn)`.

Use for:

- pure business logic
- calling services
- mutating shared execution context

## Delay Step

- Purpose: wait for a duration before continuing.
- Type: `DelayStepDef`.
- Builder API: `.delay(msOrSelector)`.

Notes:

- accepts a fixed duration or duration selector
- stoppable while waiting

## Child Flow Step

- Purpose: execute one child flow sequentially.
- Type: `ChildFlowStepDef`.
- Builder API: `.childFlow(flow, adapt?)`.

Notes:

- useful for explicit flow composition outside branching/iteration
- `adapt` can provide child context before execution
- retrying a child-flow step re-runs it against the current mutated context

## Try-Catch Step

- Purpose: run one child flow and recover with another child flow when the try branch fails.
- Type: `TryCatchStepDef`.
- Builder API: `.try(tryFlow, adapt?).catch(catchFlow, adapt?).end()`.

Notes:

- successful catch path marks the outer step as `Completed`
- stop bypasses the catch path
- outer `retry(...)` reruns the whole try-catch block

## Parallel Step

- Purpose: execute multiple branch flows concurrently.
- Type: `ParallelStepDef`.
- Builder API: `.parallel().branch(...).join()`.

Notes:

- each branch is an `IFlowDef`
- `adapt` can map parent context into branch context
- strategy controls completion behavior (`all-settled`, `fail-fast`, etc.)
- `fail-fast`, `first-settled`, and `first-completed` request stop on losing branches and wait for them to settle

## While Step

- Purpose: repeated iteration while condition is true.
- Type: `WhileStepDef`.
- Builder API: `.while(condition, iterationFlow, adapt?)`.

Notes:

- condition is evaluated each cycle
- `iterationFlow` runs per cycle
- `adapt` can provide specialized iteration context

## Switch Step

- Purpose: select exactly one branch by predicate.
- Type: `SwitchStepDef`.
- Builder API:
  - `.switchOn(selector)`
  - `.case(value, flow, adapt?)`
  - `.caseWhen(predicate, flow, adapt?)`
  - `.default(flow, adapt?)`
  - `.end()`

Notes:

- first matching case wins
- if no case matches and no default exists, no branch runs

## ForEach Step

- Purpose: execute one child flow per item, sequentially.
- Type: `ForEachStepDef`.
- Builder API: `.forEach(selector).run(flow, adapt?)`.

`adapt(parentCtx, item)` can transform context per item.

`break()` is supported inside child flows started by `forEach` and exits the nearest `forEach` loop.

## ParallelForEach Step

- Purpose: execute one child flow per item, in parallel.
- Type: `ParallelForEachStepDef`.
- Builder API: `.parallelForEach(selector).run(flow, adapt?).<strategy>().join()`.

Strategies are the same as `parallel`, including loser-stop behavior for non-`all-settled` strategies.

`break()` is not supported inside `parallelForEach` item flows in v1.

## Break Step

- Purpose: exit the nearest enclosing `while` or `forEach` loop.
- Type: `BreakLoopStepDef`.
- Builder API: `.break()`.

Notes:

- it is structured control flow, not failure or cancellation
- it bubbles through non-loop structures until a loop consumes it
- using it outside `while` or `forEach` rejects with `UncaughtBreakLoopError`
- using it from inside `parallel` or `parallelForEach` is a modeling/runtime error

## Step IDs

All step definitions have an id.

- If omitted, an id is auto-generated.
- Use `.step("my-id")` to set id for the next step.
