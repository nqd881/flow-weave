# Step Types

This page explains each built-in step definition and its intent.

All step types support optional step hooks through fluent builder hook methods:

- `hooks.pre[]`
- `hooks.post[]`

Hooks are step-level lifecycle hooks (not per-branch/per-item hooks).

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

## Parallel Step

- Purpose: execute multiple branch flows concurrently.
- Type: `ParallelStepDef`.
- Builder API: `.parallel().branch(...).join()`.

Notes:

- each branch is an `IFlowDef`
- `adapt` can map parent context into branch context
- strategy controls completion behavior (`all-settled`, `fail-fast`, etc.)

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

## ParallelForEach Step

- Purpose: execute one child flow per item, in parallel.
- Type: `ParallelForEachStepDef`.
- Builder API: `.parallelForEach(selector).run(flow, adapt?).<strategy>().join()`.

Strategies are the same as `parallel`.

## Step IDs

All step definitions have an id.

- If omitted, an id is auto-generated.
- Use `.step("my-id")` to set id for the next step.
