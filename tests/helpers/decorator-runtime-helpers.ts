import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as flowWeave from "../../src";
import * as decorator from "../../src/authoring/decorator";
import * as saga from "../../src/saga";

type ModuleExports = Record<string, unknown>;

const projectRoot = process.cwd();

const directModuleBindings = new Map<string, unknown>([
  ["flow-weave", flowWeave],
  ["flow-weave/decorator", decorator],
  ["flow-weave/saga", saga],
]);

const sourcePathBindings = new Map<string, unknown>([
  [path.resolve(projectRoot, "src"), flowWeave],
  [path.resolve(projectRoot, "src/authoring/decorator"), decorator],
  [path.resolve(projectRoot, "src/saga"), saga],
]);

function createFixtureRequire(
  fixturePath: string,
): (specifier: string) => unknown {
  const fixtureDir = path.dirname(fixturePath);

  return (specifier: string) => {
    const directBinding = directModuleBindings.get(specifier);

    if (directBinding) {
      return directBinding;
    }

    if (specifier.startsWith(".")) {
      const resolvedSpecifier = path.resolve(fixtureDir, specifier);
      const sourceBinding = sourcePathBindings.get(resolvedSpecifier);

      if (sourceBinding) {
        return sourceBinding;
      }
    }

    throw new Error(`Unsupported decorator fixture import: ${specifier}`);
  };
}

function evaluateDecoratedSource<TExports extends ModuleExports>(
  source: string,
  fixturePath: string,
  bindings: Record<string, unknown> = {},
): TExports {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });

  const module = { exports: {} as TExports };
  const context: Record<string, unknown> = {
    ...flowWeave,
    ...decorator,
    ...saga,
    ...bindings,
    module,
    exports: module.exports,
    require: createFixtureRequire(fixturePath),
    console,
    process,
    Symbol,
    setTimeout,
    clearTimeout,
    queueMicrotask,
  };

  context.globalThis = context;

  vm.runInNewContext(transpiled.outputText, context, {
    filename: fixturePath,
  });

  return module.exports;
}

export function evaluateDecoratedFixture<TExports extends ModuleExports>(
  fixturePath: string,
  bindings: Record<string, unknown> = {},
): TExports {
  const absoluteFixturePath = path.resolve(projectRoot, fixturePath);
  const source = fs.readFileSync(absoluteFixturePath, "utf8");

  return evaluateDecoratedSource(source, absoluteFixturePath, bindings);
}
