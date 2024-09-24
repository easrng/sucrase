import type CJSImportProcessor from "./CJSImportProcessor.js";
import computeSourceMap, {type RawSourceMap} from "./computeSourceMap.js";
import {HelperManager} from "./HelperManager.js";
import identifyShadowedGlobals from "./identifyShadowedGlobals.js";
import NameManager from "./NameManager.js";
import type {CoreOptions, SourceMapOptions, Transformers} from "./Options.js";
import {parse} from "./parser/index.js";
import type {Scope} from "./parser/tokenizer/state.js";
import TokenProcessor from "./TokenProcessor.js";
import RootTransformer from "./transformers/RootTransformer.js";
import formatTokens from "./util/formatTokens.js";

export interface TransformResult {
  code: string;
  sourceMap?: RawSourceMap;
}

export interface SucraseContext {
  tokenProcessor: TokenProcessor;
  scopes: Array<Scope>;
  nameManager: NameManager;
  importProcessor: CJSImportProcessor | null;
  helperManager: HelperManager;
}

export type {CoreOptions, SourceMapOptions, Transformers};

export function getVersion(): string {
  /* istanbul ignore next */
  return "3.35.0";
}

export function coreTransform(code: string, options: CoreOptions): TransformResult {
  try {
    const sucraseContext = getSucraseContext(code, options);
    const transformer = new RootTransformer(
      sucraseContext,
      options.transformers,
      Boolean(options.enableLegacyBabel5ModuleInterop),
      options,
    );
    const transformerResult = transformer.transform();
    let result: TransformResult = {code: transformerResult.code};
    if (options.sourceMapOptions) {
      if (!options.filePath) {
        throw new Error("filePath must be specified when generating a source map.");
      }
      result = {
        ...result,
        sourceMap: computeSourceMap(
          transformerResult,
          options.filePath,
          options.sourceMapOptions,
          code,
          sucraseContext.tokenProcessor.tokens,
        ),
      };
    }
    return result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (options.filePath) {
      e.message = `Error transforming ${options.filePath}: ${e.message}`;
    }
    throw e;
  }
}

export function coreGetFormattedTokens(code: string, options: CoreOptions): string {
  const tokens = getSucraseContext(code, options).tokenProcessor.tokens;
  return formatTokens(code, tokens);
}

/**
 * Call into the parser/tokenizer and do some further preprocessing:
 * - Come up with a set of used names so that we can assign new names.
 * - Preprocess all import/export statements so we know which globals we are interested in.
 * - Compute situations where any of those globals are shadowed.
 *
 * In the future, some of these preprocessing steps can be skipped based on what actual work is
 * being done.
 */
function getSucraseContext(code: string, options: CoreOptions): SucraseContext {
  const {JSXTransformer, TypeScriptTransformer, FlowTransformer} = options.transformers;
  const optionalChainingNullishEnabled = Boolean(
    options.transformers.OptionalChainingNullishTransformer,
  );
  const file = parse(
    code,
    JSXTransformer?.plugin,
    TypeScriptTransformer?.plugin,
    FlowTransformer?.plugin,
  );
  const tokens = file.tokens;
  const scopes = file.scopes;

  const nameManager = new NameManager(code, tokens);
  const helperManager = new HelperManager(nameManager, options.dynamicImportFunction);
  const tokenProcessor = new TokenProcessor(
    code,
    tokens,
    Boolean(FlowTransformer),
    optionalChainingNullishEnabled,
    helperManager,
  );
  const enableLegacyTypeScriptModuleInterop = Boolean(options.enableLegacyTypeScriptModuleInterop);

  const {CJSImportProcessor} = options.transformers;
  let importProcessor = null;
  if (CJSImportProcessor) {
    importProcessor = new CJSImportProcessor(
      nameManager,
      tokenProcessor,
      enableLegacyTypeScriptModuleInterop,
      options,
      Boolean(TypeScriptTransformer),
      Boolean(options.keepUnusedImports),
      helperManager,
    );
    importProcessor.preprocessTokens();
    // We need to mark shadowed globals after processing imports so we know that the globals are,
    // but before type-only import pruning, since that relies on shadowing information.
    identifyShadowedGlobals(tokenProcessor, scopes, importProcessor.getGlobalNames());
    if (TypeScriptTransformer && !options.keepUnusedImports) {
      importProcessor.pruneTypeOnlyImports();
    }
  } else if (TypeScriptTransformer && !options.keepUnusedImports) {
    // Shadowed global detection is needed for TS implicit elision of imported names.
    identifyShadowedGlobals(
      tokenProcessor,
      scopes,
      TypeScriptTransformer.getImportedNames(tokenProcessor),
    );
  }
  return {tokenProcessor, scopes, nameManager, importProcessor, helperManager};
}
