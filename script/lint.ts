#!./node_modules/.bin/tsx
/* eslint-disable no-console */
import {exists} from "../src/util/exists.js";
import run from "./run.js";

const TSC = "./node_modules/.bin/tsc";
const ESLINT = "./node_modules/.bin/eslint";

function isFix(): boolean {
  return process.argv.includes("--fix");
}

async function main(): Promise<void> {
  // Linting sub-projects requires the latest Sucrase types, so require a build first.
  if (!(await exists("./dist"))) {
    console.log("Must run build before lint, running build...");
    await run("yarn build");
  }
  await Promise.all([
    checkSucrase(),
    checkProject("./integrations/gulp-plugin"),
    checkProject("./integrations/jest-plugin"),
    checkProject("./integrations/webpack-loader"),
    checkProject("./integrations/webpack-object-rest-spread-plugin"),
    checkProject("./website"),
  ]);
}

async function checkSucrase(): Promise<void> {
  await Promise.all([
    run(`${TSC} --project . --noEmit`),
    run(
      `${ESLINT} ${isFix() ? "--fix" : ""} ${[
        "benchmark",
        "example-runner",
        "generator",
        "integration-test",
        "script",
        "spec-compliance-tests",
        "src",
        "test",
      ]
        .map((dir) => `'${dir}/**/*.{ts,mts,cts}'`)
        .join(" ")}`,
    ),
  ]);
}

async function checkProject(path: string): Promise<void> {
  await Promise.all([
    run(`${TSC} --project ${path} --noEmit`),
    run(`${ESLINT} ${isFix() ? "--fix" : ""} '${path}/src/**/*.{ts,tsx}'`),
  ]);
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
