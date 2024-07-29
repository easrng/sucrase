import type {File} from "../index.js";
import {nextToken, skipLineComment} from "../tokenizer/index.js";
import {charCodes} from "../util/charcodes.js";
import {input, state} from "./base.js";
import {parseTopLevel} from "./statement.js";

export function parseFile(): File {
  // If enabled, skip leading hashbang line.
  if (
    state.pos === 0 &&
    input.charCodeAt(0) === charCodes.numberSign &&
    input.charCodeAt(1) === charCodes.exclamationMark
  ) {
    skipLineComment(2);
  }
  nextToken();
  return parseTopLevel();
}
