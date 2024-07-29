#!./node_modules/.bin/tsx
/* eslint-disable no-console */
import {writeFile} from "fs/promises";

import run from "../script/run.js";
import generateReadWordTree from "./generateReadWordTree.js";
import generateTokenTypes from "./generateTokenTypes.js";

/**
 * Use code generation.
 */
async function generate(): Promise<void> {
  await writeFile("./src/parser/tokenizer/types.ts", generateTokenTypes());
  await run("./node_modules/.bin/prettier --write ./src/parser/tokenizer/types.ts");
  await writeFile("./src/parser/tokenizer/readWordTree.ts", generateReadWordTree());
  await run("./node_modules/.bin/prettier --write ./src/parser/tokenizer/readWordTree.ts");
  console.log("Done with code generation.");
}

generate().catch((e) => {
  console.error("Error during code generation!");
  console.error(e);
  process.exitCode = 1;
});
