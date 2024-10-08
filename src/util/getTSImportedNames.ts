import {TokenType as tt} from "../parser/tokenizer/types.js";
import type TokenProcessor from "../TokenProcessor.js";
import getImportExportSpecifierInfo from "./getImportExportSpecifierInfo.js";

/**
 * Special case code to scan for imported names in ESM TypeScript. We need to do this so we can
 * properly get globals so we can compute shadowed globals.
 *
 * This is similar to logic in CJSImportProcessor, but trimmed down to avoid logic with CJS
 * replacement and flow type imports.
 */
export default function getTSImportedNames(tokens: TokenProcessor): Set<string> {
  const importedNames = new Set<string>();
  for (let i = 0; i < tokens.tokens.length; i++) {
    if (
      tokens.matches1AtIndex(i, tt._import) &&
      !tokens.matches3AtIndex(i, tt._import, tt.name, tt.eq)
    ) {
      collectNamesForImport(tokens, i, importedNames);
    }
  }
  return importedNames;
}

function collectNamesForImport(
  tokens: TokenProcessor,
  index: number,
  importedNames: Set<string>,
): void {
  index++;

  if (tokens.matches1AtIndex(index, tt.parenL)) {
    // Dynamic import, so nothing to do
    return;
  }

  if (tokens.matches1AtIndex(index, tt.name)) {
    importedNames.add(tokens.identifierNameAtIndex(index));
    index++;
    if (tokens.matches1AtIndex(index, tt.comma)) {
      index++;
    }
  }

  if (tokens.matches1AtIndex(index, tt.star)) {
    // * as
    index += 2;
    importedNames.add(tokens.identifierNameAtIndex(index));
    index++;
  }

  if (tokens.matches1AtIndex(index, tt.braceL)) {
    index++;
    collectNamesForNamedImport(tokens, index, importedNames);
  }
}

function collectNamesForNamedImport(
  tokens: TokenProcessor,
  index: number,
  importedNames: Set<string>,
): void {
  while (true) {
    if (tokens.matches1AtIndex(index, tt.braceR)) {
      return;
    }

    const specifierInfo = getImportExportSpecifierInfo(tokens, index);
    index = specifierInfo.endIndex;
    if (!specifierInfo.isType) {
      importedNames.add(specifierInfo.rightName);
    }

    if (tokens.matches2AtIndex(index, tt.comma, tt.braceR)) {
      return;
    } else if (tokens.matches1AtIndex(index, tt.braceR)) {
      return;
    } else if (tokens.matches1AtIndex(index, tt.comma)) {
      index++;
    } else {
      throw new Error(`Unexpected token: ${JSON.stringify(tokens.tokens[index])}`);
    }
  }
}
