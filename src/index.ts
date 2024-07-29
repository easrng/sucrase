import {
  type CoreOptions,
  type SourceMapOptions,
  type SucraseContext,
  type TransformResult,
  coreGetFormattedTokens,
  getVersion,
  coreTransform,
  type Transformers,
} from "./core.js";
import CJSImportTransformer from "./transformers/CJSImportTransformer.js";
import ESMImportTransformer from "./transformers/ESMImportTransformer.js";
import FlowTransformer from "./transformers/FlowTransformer.js";
import JestHoistTransformer from "./transformers/JestHoistTransformer.js";
import JSXTransformer from "./transformers/JSXTransformer.js";
import NumericSeparatorTransformer from "./transformers/NumericSeparatorTransformer.js";
import OptionalCatchBindingTransformer from "./transformers/OptionalCatchBindingTransformer.js";
import OptionalChainingNullishTransformer from "./transformers/OptionalChainingNullishTransformer.js";
import ReactDisplayNameTransformer from "./transformers/ReactDisplayNameTransformer.js";
import ReactHotLoaderTransformer from "./transformers/ReactHotLoaderTransformer.js";
import TypeScriptTransformer from "./transformers/TypeScriptTransformer.js";

export type Transform = "jsx" | "typescript" | "flow" | "imports" | "react-hot-loader" | "jest";
export type Options = Omit<CoreOptions, "transformers"> & {
  transforms: Array<Transform>;
  disableESTransforms?: boolean;
};
function coreify(options: Options): CoreOptions {
  const transformers: Transformers = options.transforms.includes("imports")
    ? {
        CJSImportTransformer,
      }
    : {
        ESMImportTransformer,
      };
  for (const name of options.transforms) {
    if (name === "jsx") {
      transformers.JSXTransformer = JSXTransformer;
      transformers.ReactDisplayNameTransformer = ReactDisplayNameTransformer;
    }
    if (name === "typescript") {
      transformers.TypeScriptTransformer = TypeScriptTransformer;
    }
    if (name === "flow") {
      transformers.FlowTransformer = FlowTransformer;
    }
    if (name === "react-hot-loader") {
      transformers.ReactHotLoaderTransformer = ReactHotLoaderTransformer;
    }
    if (name === "jest") {
      transformers.JestHoistTransformer = JestHoistTransformer;
    }
  }
  if (!options.disableESTransforms) {
    transformers.NumericSeparatorTransformer = NumericSeparatorTransformer;
    transformers.OptionalCatchBindingTransformer = OptionalCatchBindingTransformer;
    transformers.OptionalChainingNullishTransformer = OptionalChainingNullishTransformer;
    transformers.ClassTransformer = true;
  }
  return {
    ...options,
    transformers,
  };
}

export function transform(code: string, options: Options): TransformResult {
  return coreTransform(code, coreify(options));
}

/**
 * Return a string representation of the sucrase tokens, mostly useful for
 * diagnostic purposes.
 */
export function getFormattedTokens(code: string, options: Options): string {
  return coreGetFormattedTokens(code, coreify(options));
}
export {type SourceMapOptions, type SucraseContext, getVersion};
