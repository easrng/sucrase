import {type TransformResult, coreTransform} from "./core.js";
import ESMImportTransformer from "./transformers/ESMImportTransformer.js";
import TypeScriptTransformer from "./transformers/TypeScriptTransformer.js";

const options = {
  transformers: {
    ESMImportTransformer,
    TypeScriptTransformer,
  },
};
export function transform(code: string): TransformResult {
  return coreTransform(code, options);
}
