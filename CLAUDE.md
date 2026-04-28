# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- Install deps: `npm install`
- Type-check: `npm run typecheck`
- Build library: `npm run build`
- Run test suite: `npm test`
- Verify packed package surface: `npm run smoke:pack`
- Run examples:
  - Core flow: `npm run example:core`
  - Saga example: `npm run example` (or `npm run example:saga`)
  - Advanced branching/iteration: `npm run example:advanced`

### Test execution details

- Tests run with Vitest via `npm test`.
- Test files live under `tests/**/*.test.ts` with shared helpers in `tests/helpers/`.
- Decorator syntax coverage is split:
  - `tests/decorators/*.typecheck.ts` covers direct decorator syntax via `tsc`
  - runtime decorator tests use transpiled fixture modules under `tests/fixtures/decorators/`
- To isolate one test, use Vitest filtering (for example `npx vitest run tests/app/flow-weave-app.test.ts`).

## High-level architecture

`flow-weave` is a TypeScript workflow toolkit with two main layers:

1. **Authoring layer (build flow definitions)**
2. **Runtime layer (execute definitions with registered executors)**

### Entry point and app composition

- Public package entrypoints:
  - root: `flow-weave` -> `src/index.ts`
  - builder: `flow-weave/builder` -> `src/authoring/builder/index.ts`
  - decorator: `flow-weave/decorator` -> `src/authoring/decorator/index.ts`
  - saga: `flow-weave/saga` -> `src/saga/index.ts`
- Root package intentionally exports app/runtime/model/plugin APIs only.
- Root package does **not** export decorators or saga APIs.
- App builder: `FlowWeave.create().use(...plugins).build()` in `src/app/flow-weave.ts`
- Built app (`FlowWeaveApp`) exposes:
  - `weaver()` for definition authoring
  - `runtime()` for execution

### Authoring model

There are two first-class authoring surfaces:

1. **Builder authoring** under `src/authoring/builder/`
2. **Decorator authoring** under `src/authoring/decorator/`

#### Builder authoring (Weaver + fluent builders)

- Base DSL starts from `Weaver.flow<TContext>(...)` and returns `FlowDefBuilder` (`src/authoring/builder/flow-def-builder.ts`).
- `FlowDefBuilder` manages step draft lifecycle (`step()`, metadata hooks/retry, then flush into immutable step defs on `build()`).
- Supported built-in step DSL includes:
  - `task`, `delay`, `childFlow`
  - `parallel().branch(...).join()`
  - `while`, `if`, `switchOn`
  - `forEach`, `parallelForEach`
- Step metadata (hooks/retry/id) is attached during draft phase before step materialization.

#### Decorator authoring

- Core decorators live under `src/authoring/decorator/` and are published from `flow-weave/decorator`.
- Decorators compile down to the same `FlowDef` / `StepDef` model as the builder surface.
- Shared decorator infrastructure lives in:
  - `src/authoring/decorator/metadata.ts`
  - `src/authoring/decorator/compile.ts`
  - `src/authoring/decorator/decorator-factories.ts`
- Decorator validation and builder validation share `src/authoring/validation-errors.ts`.
- Decorators are static-only and rely on TC39 Stage 3 decorator metadata.

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
- Saga decorators are owned by `src/saga/decorators/saga.decorator.ts` and are published from `flow-weave/saga`, not from `flow-weave/decorator`.

## Repo structure map (working level)

- `src/authoring/`: shared authoring infrastructure (`authoring-error.ts`, `validation-errors.ts`)
- `src/authoring/builder/`: fluent builder machinery and builder-only errors
- `src/authoring/decorator/`: core flow decorators, decorator helpers, decorator-only errors
- `src/flow/`: core flow defs and shared flow model types
- `src/runtime/`: providers, registries, built-ins, execution internals, runtime/builder composition
- `src/saga/`: saga-specific definitions, decorators, authoring, runtime, compensation, plugin
- `src/plugin/`: plugin interfaces
- `docs/`: first-class guides for builder, decorator, saga, plus v4 migration notes
- `examples/`: runnable public-surface examples using `flow-weave` and `flow-weave/saga` imports
- `tests/`: Vitest coverage for app + runtime + saga behavior, plus decorator typecheck/runtime coverage

## Packaging notes

- The package surface is controlled by `package.json.exports`.
- If you change public exports, update all of:
  - `package.json.exports`
  - `README.md`
  - docs under `docs/`
  - migration notes under `docs/migrations/`
  - `scripts/smoke-pack.mjs`
- Before publish-facing changes are considered done, run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run smoke:pack`
