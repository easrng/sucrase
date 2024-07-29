import type * as flowPluginType from "../plugins/flow.js";
import type * as jsxPluginType from "../plugins/jsx/index.js";
import type * as typeScriptPluginType from "../plugins/typescript.js";
import State from "../tokenizer/state.js";
import {charCodes} from "../util/charcodes.js";

export let jsxPlugin: typeof jsxPluginType | undefined;
export let typeScriptPlugin: typeof typeScriptPluginType | undefined;
export let flowPlugin: typeof flowPluginType | undefined;
export let state: State;
export let input: string;
export let nextContextId: number;

export function getNextContextId(): number {
  return nextContextId++;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function augmentError(error: any): any {
  if ("pos" in error) {
    const loc = locationForIndex(error.pos);
    error.message += ` (${loc.line}:${loc.column})`;
    error.loc = loc;
  }
  return error;
}

export class Loc {
  line: number;
  column: number;
  constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }
}

export function locationForIndex(pos: number): Loc {
  let line = 1;
  let column = 1;
  for (let i = 0; i < pos; i++) {
    if (input.charCodeAt(i) === charCodes.lineFeed) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return new Loc(line, column);
}

export function initParser(
  inputCode: string,
  jsxPluginArg?: typeof jsxPluginType,
  typeScriptPluginArg?: typeof typeScriptPluginType,
  flowPluginArg?: typeof flowPluginType,
): void {
  input = inputCode;
  state = new State();
  nextContextId = 1;
  jsxPlugin = jsxPluginArg;
  typeScriptPlugin = typeScriptPluginArg;
  flowPlugin = flowPluginArg;
}
