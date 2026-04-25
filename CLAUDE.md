# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- Install deps: `npm install`
- Type-check: `npm run typecheck`
- Build library: `npm run build`
- Run test suite: `npm test`
- Run examples:
  - Core flow: `npm run example:core`
  - Saga example: `npm run example` (or `npm run example:saga`)
  - Advanced branching/iteration: `npm run example:advanced`

### Test execution details

- Tests run with Vitest via `npm test`.
- Test files live under `tests/**/*.test.ts` with shared helpers in `tests/helpers/`.
- To isolate one test, use Vitest filtering (for example `npx vitest run tests/app/flow-weave-app.test.ts`).

## High-level architecture

`flow-weave` is a TypeScript workflow toolkit with two main layers:

1. **Authoring layer (build flow definitions)**
2. **Runtime layer (execute definitions with registered executors)**

### Entry point and app composition

- Public exports: `src/index.ts`
- App builder: `FlowWeave.create().use(...plugins).build()` in `src/app/flow-weave.ts`
- Built app (`FlowWeaveApp`) exposes:
  - `weaver()` for definition authoring
  - `runtime()` for execution

### Authoring model (Weaver + fluent builders)

- Base DSL starts from `Weaver.flow<TContext>(...)` and returns `FlowDefBuilder` (`src/authoring/flow-def-builder.ts`).
- `FlowDefBuilder` manages step draft lifecycle (`step()`, metadata hooks/retry, then flush into immutable step defs on `build()`).
- Supported built-in step DSL includes:
  - `task`, `delay`, `childFlow`
  - `parallel().branch(...).join()`
  - `while`, `if`, `switchOn`
  - `forEach`, `parallelForEach`
- Step metadata (hooks/retry/id) is attached during draft phase before step materialization.

### Runtime execution model

- Runtime construction: `RuntimeBuilder` (`src/runtime/runtime-builder.ts`) with built-ins wired by `registerBuiltInRuntimeComponents` (`src/runtime/built-ins/register-built-in-runtime-components.ts`).
- `Runtime` (`src/runtime/runtime.ts`) delegates:
  - flow kind -> flow runtime via `FlowRuntimeRegistry`
  - step execution creation + step executor resolution to the selected flow runtime
- `FlowExecution` (`src/runtime/execution/flow-execution.ts`) owns lifecycle/state (`pending/running/completed/stopped/failed`) and stop propagation hooks.
- `FlowExecutor` (`src/runtime/execution/flow-executor.ts`) runs steps sequentially, creates `StepExecution`s, and propagates shared control signals (`StopSignal`, `BreakLoopSignal`).

### Plugin and extensibility architecture

- Plugin contract: `FlowPlugin` (`src/plugin/flow-plugin.ts`) has two install surfaces:
  - `installWeaver(...)` to extend DSL methods
  - `installRuntime(...)` to register runtime components
- `WeaverBuilder` supports method extension and plugin dependency checks (`dependsOn`).
- `RuntimeBuilder` mirrors plugin dependency checks and runtime registration.
- This dual installation pattern is required when introducing new flow kinds or custom step types.

### Saga as a first-party plugin

- Saga support is not in core runtime by default.
- `sagaPlugin` (`src/saga/saga-plugin.ts`) adds:
  - `weaver.saga(...)` DSL method
  - `SagaFlowRuntime` runtime support (`src/saga/runtime/saga-flow-runtime.ts`)
- Core apps (`FlowWeave.create().build()`) cannot execute saga defs unless `use(sagaPlugin)` is applied before `build()`.

## Repo structure map (working level)

- `src/authoring/`: fluent DSL and builder machinery
- `src/flow/`: core flow defs and shared flow model types
- `src/runtime/`: providers, registries, built-ins, execution internals, runtime/builder composition
- `src/saga/`: saga-specific definitions, authoring, runtime, compensation, plugin
- `src/plugin/`: plugin interfaces
- `docs/`: behavior references (hooks, cancellation, step types, saga, extensibility)
- `examples/`: runnable usage samples
- `tests/`: Vitest coverage for app + authoring + runtime + saga behavior
