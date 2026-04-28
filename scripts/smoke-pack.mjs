import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow-weave-pack-"));

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

try {
  const packOutput = run(
    "npm",
    ["pack", "--json", "--pack-destination", tempRoot],
    projectRoot,
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarballPath = path.join(tempRoot, filename);
  const consumerDir = path.join(tempRoot, "consumer");

  fs.mkdirSync(consumerDir, { recursive: true });
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify({ name: "flow-weave-pack-smoke", private: true }, null, 2),
  );

  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-package-lock", tarballPath],
    { cwd: consumerDir, stdio: "inherit" },
  );

  execFileSync(
    "node",
    [
      "-e",
      `
const root = require("flow-weave");
const builder = require("flow-weave/builder");
const decorator = require("flow-weave/decorator");
const saga = require("flow-weave/saga");

if (typeof root.FlowWeave !== "function") throw new Error("root missing FlowWeave");
if (typeof builder.WeaverBuilder !== "function") throw new Error("builder missing WeaverBuilder");
if (typeof decorator.Flow !== "function") throw new Error("decorator missing Flow");
if (typeof saga.sagaPlugin !== "object") throw new Error("saga missing sagaPlugin");

if ("Flow" in root || "sagaPlugin" in root || "Saga" in root) {
  throw new Error("root unexpectedly exports decorator or saga surface");
}

console.log("pack-smoke-ok");
`,
    ],
    { cwd: consumerDir, stdio: "inherit" },
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
