import {eatTypeToken, lookaheadType, match} from "../tokenizer/index.js";
import {TokenType as tt} from "../tokenizer/types.js";
import {flowPlugin, typeScriptPlugin} from "../traverser/base.js";
import {baseParseConditional} from "../traverser/expression.js";

/**
 * Common parser code for TypeScript and Flow.
 */

// An apparent conditional expression could actually be an optional parameter in an arrow function.
export function typedParseConditional(noIn: boolean): void {
  // If we see ?:, this can't possibly be a valid conditional. typedParseParenItem will be called
  // later to finish off the arrow parameter. We also need to handle bare ? tokens for optional
  // parameters without type annotations, i.e. ?, and ?) .
  if (match(tt.question)) {
    const nextType = lookaheadType();
    if (nextType === tt.colon || nextType === tt.comma || nextType === tt.parenR) {
      return;
    }
  }
  baseParseConditional(noIn);
}

// Note: These "type casts" are *not* valid TS expressions.
// But we parse them here and change them when completing the arrow function.
export function typedParseParenItem(): void {
  eatTypeToken(tt.question);
  if (match(tt.colon)) {
    if (typeScriptPlugin) {
      typeScriptPlugin.tsParseTypeAnnotation();
    } else if (flowPlugin) {
      flowPlugin.flowParseTypeAnnotation();
    }
  }
}
