#!./node_modules/.bin/tsx
/* eslint-disable no-console */
import {next} from "../src/parser/tokenizer/index.js";
import {initParser} from "../src/parser/traverser/base.js";
import {hasPrecedingLineBreak} from "../src/parser/traverser/util.js";

function main(): void {
  const benchmark = process.argv[2] || "all";
  console.log(`Running microbenchmark ${benchmark}`);
  if (benchmark === "all" || benchmark === "hasPredecingLineBreak") {
    initParser("let x\nx++;");
    next();
    next();
    next();
    runMicrobenchmark(
      "hasPredecingLineBreak",
      () => {
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
      },
      1000000,
    );
  }
}

function runMicrobenchmark(name: string, runTrial: () => void, times: number = 100): void {
  // Run before starting the clock to warm up the JIT, caches, etc.
  for (let i = 0; i < 10; i++) {
    runTrial();
  }
  console.time(name);
  for (let i = 0; i < times; i++) {
    runTrial();
  }
  console.timeEnd(name);
}

main();
