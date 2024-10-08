import type {CoreOptions} from "../core.js";
import type {HelperManager} from "../HelperManager.js";
import type NameManager from "../NameManager.js";
import {ContextualKeyword} from "../parser/tokenizer/keywords.js";
import {TokenType as tt} from "../parser/tokenizer/types.js";
import type TokenProcessor from "../TokenProcessor.js";
import elideImportEquals from "../util/elideImportEquals.js";
import getDeclarationInfo, {
  type DeclarationInfo,
  EMPTY_DECLARATION_INFO,
} from "../util/getDeclarationInfo.js";
import getImportExportSpecifierInfo from "../util/getImportExportSpecifierInfo.js";
import {getNonTypeIdentifiers} from "../util/getNonTypeIdentifiers.js";
import isExportFrom from "../util/isExportFrom.js";
import {removeMaybeImportAttributes} from "../util/removeMaybeImportAttributes.js";
import shouldElideDefaultExport from "../util/shouldElideDefaultExport.js";
import type ReactHotLoaderTransformer from "./ReactHotLoaderTransformer.js";
import Transformer from "./Transformer.js";

/**
 * Class for editing import statements when we are keeping the code as ESM. We still need to remove
 * type-only imports in TypeScript and Flow.
 */
export default class ESMImportTransformer extends Transformer {
  private nonTypeIdentifiers: Set<string>;
  private declarationInfo: DeclarationInfo;
  private injectCreateRequireForImportRequire: boolean;
  private dynamicImportFunction?: string;
  private rewriteImportSpecifier?: (specifier: string) => string;

  constructor(
    readonly tokens: TokenProcessor,
    readonly nameManager: NameManager,
    readonly helperManager: HelperManager,
    readonly reactHotLoaderTransformer: ReactHotLoaderTransformer | null,
    readonly isTypeScriptTransformEnabled: boolean,
    readonly isFlowTransformEnabled: boolean,
    readonly keepUnusedImports: boolean,
    options: CoreOptions,
  ) {
    super();
    this.nonTypeIdentifiers =
      isTypeScriptTransformEnabled && !keepUnusedImports
        ? getNonTypeIdentifiers(tokens, options)
        : new Set();
    this.declarationInfo =
      isTypeScriptTransformEnabled && !keepUnusedImports
        ? getDeclarationInfo(tokens)
        : EMPTY_DECLARATION_INFO;
    this.injectCreateRequireForImportRequire = Boolean(options.injectCreateRequireForImportRequire);
    this.dynamicImportFunction = options.dynamicImportFunction;
    this.rewriteImportSpecifier = options.rewriteImportSpecifier;
  }

  process(): boolean {
    // TypeScript `import foo = require('foo');` should always just be translated to plain require.
    if (this.tokens.matches3(tt._import, tt.name, tt.eq)) {
      return this.processImportEquals();
    }
    if (
      this.tokens.matches4(tt._import, tt.name, tt.name, tt.eq) &&
      this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._type)
    ) {
      // import type T = require('T')
      this.tokens.removeInitialToken();
      // This construct is always exactly 8 tokens long, so remove the 7 remaining tokens.
      for (let i = 0; i < 7; i++) {
        this.tokens.removeToken();
      }
      return true;
    }
    if (this.tokens.matches2(tt._export, tt.eq)) {
      this.tokens.replaceToken("module.exports");
      return true;
    }
    if (
      this.tokens.matches5(tt._export, tt._import, tt.name, tt.name, tt.eq) &&
      this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 2, ContextualKeyword._type)
    ) {
      // export import type T = require('T')
      this.tokens.removeInitialToken();
      // This construct is always exactly 9 tokens long, so remove the 8 remaining tokens.
      for (let i = 0; i < 8; i++) {
        this.tokens.removeToken();
      }
      return true;
    }
    if (this.tokens.matches1(tt._import)) {
      return this.processImport();
    }
    if (this.tokens.matches2(tt._export, tt._default)) {
      return this.processExportDefault();
    }
    if (this.tokens.matches2(tt._export, tt.braceL)) {
      return this.processNamedExports();
    }
    if (this.rewriteImportSpecifier && this.tokens.matches2(tt._export, tt.star)) {
      this.tokens.copyExpectedToken(tt._export);
      this.tokens.copyExpectedToken(tt.star);
      if (this.tokens.matches1(tt._as)) {
        this.tokens.copyToken();
        this.tokens.copyExpectedToken(tt.name);
      }
      this.tokens.copyExpectedToken(tt.name);
      this.tokens.replaceToken(this.rewriteImportSpecifier(this.tokens.currentTokenCode()));
      return true;
    }
    if (
      this.tokens.matches2(tt._export, tt.name) &&
      this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._type)
    ) {
      // export type {a};
      // export type {a as b};
      // export type {a} from './b';
      // export type * from './b';
      // export type * as ns from './b';
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      if (this.tokens.matches1(tt.braceL)) {
        while (!this.tokens.matches1(tt.braceR)) {
          this.tokens.removeToken();
        }
        this.tokens.removeToken();
      } else {
        // *
        this.tokens.removeToken();
        if (this.tokens.matches1(tt._as)) {
          // as
          this.tokens.removeToken();
          // ns
          this.tokens.removeToken();
        }
      }
      // Remove type re-export `... } from './T'`
      if (
        this.tokens.matchesContextual(ContextualKeyword._from) &&
        this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, tt.string)
      ) {
        this.tokens.removeToken();
        this.tokens.removeToken();
        removeMaybeImportAttributes(this.tokens);
      }
      return true;
    }
    return false;
  }

  private processImportEquals(): boolean {
    const importName = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
    if (this.shouldAutomaticallyElideImportedName(importName)) {
      // If this name is only used as a type, elide the whole import.
      elideImportEquals(this.tokens);
    } else if (this.injectCreateRequireForImportRequire) {
      // We're using require in an environment (Node ESM) that doesn't provide
      // it as a global, so generate a helper to import it.
      // import -> const
      this.tokens.replaceToken("const");
      // Foo
      this.tokens.copyToken();
      // =
      this.tokens.copyToken();
      // require
      this.tokens.replaceToken(this.helperManager.getHelperName("require"));
    } else {
      // Otherwise, just switch `import` to `const`.
      this.tokens.replaceToken("const");
    }
    return true;
  }

  private processImport(): boolean {
    if (this.tokens.matches2(tt._import, tt.parenL)) {
      if (this.dynamicImportFunction) {
        this.tokens.replaceToken(this.helperManager.getHelperName("dynamicImport"));
        return true;
      } else {
        // Dynamic imports don't need to be transformed.
        return false;
      }
    }

    const snapshot = this.tokens.snapshot();
    const allImportsRemoved = this.removeImportTypeBindings();
    if (allImportsRemoved) {
      this.tokens.restoreToSnapshot(snapshot);
      while (!this.tokens.matches1(tt.string)) {
        this.tokens.removeToken();
      }
      this.tokens.removeToken();
      removeMaybeImportAttributes(this.tokens);
      if (this.tokens.matches1(tt.semi)) {
        this.tokens.removeToken();
      }
    }
    return true;
  }

  /**
   * Remove type bindings from this import, leaving the rest of the import intact.
   *
   * Return true if this import was ONLY types, and thus is eligible for removal. This will bail out
   * of the replacement operation, so we can return early here.
   */
  private removeImportTypeBindings(): boolean {
    this.tokens.copyExpectedToken(tt._import);
    if (
      this.tokens.matchesContextual(ContextualKeyword._type) &&
      !this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, tt.comma) &&
      !this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._from)
    ) {
      // This is an "import type" statement, so exit early.
      return true;
    }

    if (this.tokens.matches1(tt.string)) {
      // This is a bare import, so we should proceed with the import.
      if (this.rewriteImportSpecifier) {
        this.tokens.replaceToken(this.rewriteImportSpecifier(this.tokens.currentTokenCode()));
        return false;
      }
      this.tokens.copyToken();
      return false;
    }

    // Skip the "module" token in import reflection.
    if (
      this.tokens.matchesContextual(ContextualKeyword._module) &&
      this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 2, ContextualKeyword._from)
    ) {
      this.tokens.copyToken();
    }

    let foundNonTypeImport = false;
    let foundAnyNamedImport = false;
    let needsComma = false;

    // Handle default import.
    if (this.tokens.matches1(tt.name)) {
      if (this.shouldAutomaticallyElideImportedName(this.tokens.identifierName())) {
        this.tokens.removeToken();
        if (this.tokens.matches1(tt.comma)) {
          this.tokens.removeToken();
        }
      } else {
        foundNonTypeImport = true;
        this.tokens.copyToken();
        if (this.tokens.matches1(tt.comma)) {
          // We're in a statement like:
          // import A, * as B from './A';
          // or
          // import A, {foo} from './A';
          // where the `A` is being kept. The comma should be removed if an only
          // if the next part of the import statement is elided, but that's hard
          // to determine at this point in the code. Instead, always remove it
          // and set a flag to add it back if necessary.
          needsComma = true;
          this.tokens.removeToken();
        }
      }
    }

    if (this.tokens.matches1(tt.star)) {
      if (this.shouldAutomaticallyElideImportedName(this.tokens.identifierNameAtRelativeIndex(2))) {
        this.tokens.removeToken();
        this.tokens.removeToken();
        this.tokens.removeToken();
      } else {
        if (needsComma) {
          this.tokens.appendCode(",");
        }
        foundNonTypeImport = true;
        this.tokens.copyExpectedToken(tt.star);
        this.tokens.copyExpectedToken(tt.name);
        this.tokens.copyExpectedToken(tt.name);
      }
    } else if (this.tokens.matches1(tt.braceL)) {
      if (needsComma) {
        this.tokens.appendCode(",");
      }
      this.tokens.copyToken();
      while (!this.tokens.matches1(tt.braceR)) {
        foundAnyNamedImport = true;
        const specifierInfo = getImportExportSpecifierInfo(this.tokens);
        if (
          specifierInfo.isType ||
          this.shouldAutomaticallyElideImportedName(specifierInfo.rightName)
        ) {
          while (this.tokens.currentIndex() < specifierInfo.endIndex) {
            this.tokens.removeToken();
          }
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.removeToken();
          }
        } else {
          foundNonTypeImport = true;
          while (this.tokens.currentIndex() < specifierInfo.endIndex) {
            this.tokens.copyToken();
          }
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.copyToken();
          }
        }
      }
      this.tokens.copyExpectedToken(tt.braceR);
    }

    let allImportsRemoved: boolean;
    if (this.keepUnusedImports) {
      allImportsRemoved = false;
    } else if (this.isTypeScriptTransformEnabled) {
      allImportsRemoved = !foundNonTypeImport;
    } else if (this.isFlowTransformEnabled) {
      // In Flow, unlike TS, `import {} from 'foo';` preserves the import.
      allImportsRemoved = foundAnyNamedImport && !foundNonTypeImport;
    } else {
      allImportsRemoved = false;
    }
    if (allImportsRemoved) {
      return true;
    } else {
      if (this.rewriteImportSpecifier && this.tokens.matchesContextual(ContextualKeyword._from)) {
        this.tokens.copyToken();
        if (this.tokens.matches1(tt.string)) {
          this.tokens.replaceToken(this.rewriteImportSpecifier(this.tokens.currentTokenCode()));
        }
      }
      return false;
    }
  }

  private shouldAutomaticallyElideImportedName(name: string): boolean {
    return (
      this.isTypeScriptTransformEnabled &&
      !this.keepUnusedImports &&
      !this.nonTypeIdentifiers.has(name)
    );
  }

  private processExportDefault(): boolean {
    if (
      shouldElideDefaultExport(
        this.isTypeScriptTransformEnabled,
        this.keepUnusedImports,
        this.tokens,
        this.declarationInfo,
      )
    ) {
      // If the exported value is just an identifier and should be elided by TypeScript
      // rules, then remove it entirely. It will always have the form `export default e`,
      // where `e` is an identifier.
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      this.tokens.removeToken();
      return true;
    }

    const alreadyHasName =
      this.tokens.matches4(tt._export, tt._default, tt._function, tt.name) ||
      // export default async function
      (this.tokens.matches5(tt._export, tt._default, tt.name, tt._function, tt.name) &&
        this.tokens.matchesContextualAtIndex(
          this.tokens.currentIndex() + 2,
          ContextualKeyword._async,
        )) ||
      this.tokens.matches4(tt._export, tt._default, tt._class, tt.name) ||
      this.tokens.matches5(tt._export, tt._default, tt._abstract, tt._class, tt.name);

    if (!alreadyHasName && this.reactHotLoaderTransformer) {
      // This is a plain "export default E" statement and we need to assign E to a variable.
      // Change "export default E" to "let _default; export default _default = E"
      const defaultVarName = this.nameManager.claimFreeName("_default");
      this.tokens.replaceToken(`let ${defaultVarName}; export`);
      this.tokens.copyToken();
      this.tokens.appendCode(` ${defaultVarName} =`);
      this.reactHotLoaderTransformer.setExtractedDefaultExportName(defaultVarName);
      return true;
    }
    return false;
  }

  /**
   * Handle a statement with one of these forms:
   * export {a, type b};
   * export {c, type d} from 'foo';
   *
   * In both cases, any explicit type exports should be removed. In the first
   * case, we also need to handle implicit export elision for names declared as
   * types. In the second case, we must NOT do implicit named export elision,
   * but we must remove the runtime import if all exports are type exports.
   */
  private processNamedExports(): boolean {
    if (!(this.isTypeScriptTransformEnabled || this.rewriteImportSpecifier)) {
      return false;
    }
    const snapshot = this.tokens.snapshot();
    this.tokens.copyExpectedToken(tt._export);
    this.tokens.copyExpectedToken(tt.braceL);

    const isReExport = isExportFrom(this.tokens);
    if (!this.isTypeScriptTransformEnabled && !isReExport) {
      this.tokens.restoreToSnapshot(snapshot);
      return false;
    }
    let foundNonTypeExport = !this.isTypeScriptTransformEnabled;
    while (!this.tokens.matches1(tt.braceR)) {
      if (this.isTypeScriptTransformEnabled) {
        const specifierInfo = getImportExportSpecifierInfo(this.tokens);
        if (
          specifierInfo.isType ||
          (!isReExport && this.shouldElideExportedName(specifierInfo.leftName))
        ) {
          // Type export, so remove all tokens, including any comma.
          while (this.tokens.currentIndex() < specifierInfo.endIndex) {
            this.tokens.removeToken();
          }
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.removeToken();
          }
        } else {
          // Non-type export, so copy all tokens, including any comma.
          foundNonTypeExport = true;
          while (this.tokens.currentIndex() < specifierInfo.endIndex) {
            this.tokens.copyToken();
          }
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.copyToken();
          }
        }
      } else {
        this.tokens.copyToken();
      }
    }
    this.tokens.copyExpectedToken(tt.braceR);

    if (!this.keepUnusedImports && isReExport && !foundNonTypeExport) {
      // This is a type-only re-export, so skip evaluating the other module. Technically this
      // leaves the statement as `export {}`, but that's ok since that's a no-op.
      this.tokens.removeToken();
      this.tokens.removeToken();
      removeMaybeImportAttributes(this.tokens);
    } else if (isReExport && this.rewriteImportSpecifier) {
      this.tokens.copyToken();
      this.tokens.replaceToken(this.rewriteImportSpecifier(this.tokens.currentTokenCode()));
    }

    return true;
  }

  /**
   * ESM elides all imports with the rule that we only elide if we see that it's
   * a type and never see it as a value. This is in contrast to CJS, which
   * elides imports that are completely unknown.
   */
  private shouldElideExportedName(name: string): boolean {
    return (
      this.isTypeScriptTransformEnabled &&
      !this.keepUnusedImports &&
      this.declarationInfo.typeDeclarations.has(name) &&
      !this.declarationInfo.valueDeclarations.has(name)
    );
  }
}
