import type * as flowPluginType from "./plugins/flow.js";
import type * as jsxPluginType from "./plugins/jsx/index.js";
import type * as typeScriptPluginType from "./plugins/typescript.js";
import type {Token} from "./tokenizer/index.js";
import type {Scope} from "./tokenizer/state.js";
import {augmentError, initParser, state} from "./traverser/base.js";
import {parseFile} from "./traverser/index.js";

export class File {
  tokens: Array<Token>;
  scopes: Array<Scope>;

  constructor(tokens: Array<Token>, scopes: Array<Scope>) {
    this.tokens = tokens;
    this.scopes = scopes;
  }
}

export function parse(
  input: string,
  jsxPluginArg?: typeof jsxPluginType,
  typeScriptPluginArg?: typeof typeScriptPluginType,
  flowPluginArg?: typeof flowPluginType,
): File {
  if (flowPluginArg && typeScriptPluginArg) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }
  initParser(input, jsxPluginArg, typeScriptPluginArg, flowPluginArg);
  const result = parseFile();
  if (state.error) {
    throw augmentError(state.error);
  }
  return result;
}
