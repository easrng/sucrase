import {TokenType as tt} from "../parser/tokenizer/types.js";
import type TokenProcessor from "../TokenProcessor.js";
import Transformer from "./Transformer.js";

export default class NumericSeparatorTransformer extends Transformer {
  constructor(readonly tokens: TokenProcessor) {
    super();
  }

  process(): boolean {
    if (this.tokens.matches1(tt.num)) {
      const code = this.tokens.currentTokenCode();
      if (code.includes("_")) {
        this.tokens.replaceToken(code.replace(/_/g, ""));
        return true;
      }
    }
    return false;
  }
}
