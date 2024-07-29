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
  isJSXEnabled: boolean,
  isTypeScriptEnabled: boolean,
  isFlowEnabled: boolean,
): File {
  if (isFlowEnabled && isTypeScriptEnabled) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }
  initParser(input, isJSXEnabled, isTypeScriptEnabled, isFlowEnabled);
  const result = parseFile();
  if (state.error) {
    throw augmentError(state.error);
  }
  return result;
}
