import type {CoreOptions} from "../core.js";
import {IdentifierRole} from "../parser/tokenizer/index.js";
import {TokenType, TokenType as tt} from "../parser/tokenizer/types.js";
import type TokenProcessor from "../TokenProcessor.js";
import {startsWithLowerCase} from "../transformers/JSXTransformer.js";
import getJSXPragmaInfo from "./getJSXPragmaInfo.js";

export function getNonTypeIdentifiers(tokens: TokenProcessor, options: CoreOptions): Set<string> {
  const jsxPragmaInfo = getJSXPragmaInfo(options);
  const nonTypeIdentifiers: Set<string> = new Set();
  for (let i = 0; i < tokens.tokens.length; i++) {
    const token = tokens.tokens[i];
    if (
      token.type === tt.name &&
      !token.isType &&
      (token.identifierRole === IdentifierRole.Access ||
        token.identifierRole === IdentifierRole.ObjectShorthand ||
        token.identifierRole === IdentifierRole.ExportAccess) &&
      !token.shadowsGlobal
    ) {
      nonTypeIdentifiers.add(tokens.identifierNameForToken(token));
    }
    if (token.type === tt.jsxTagStart) {
      nonTypeIdentifiers.add(jsxPragmaInfo.base);
    }
    if (
      token.type === tt.jsxTagStart &&
      i + 1 < tokens.tokens.length &&
      tokens.tokens[i + 1].type === tt.jsxTagEnd
    ) {
      nonTypeIdentifiers.add(jsxPragmaInfo.base);
      nonTypeIdentifiers.add(jsxPragmaInfo.fragmentBase);
    }
    if (token.type === tt.jsxName && token.identifierRole === IdentifierRole.Access) {
      const identifierName = tokens.identifierNameForToken(token);
      // Lower-case single-component tag names like "div" don't count.
      if (!startsWithLowerCase(identifierName) || tokens.tokens[i + 1].type === TokenType.dot) {
        nonTypeIdentifiers.add(tokens.identifierNameForToken(token));
      }
    }
  }
  return nonTypeIdentifiers;
}
