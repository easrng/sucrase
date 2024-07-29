import type NameManager from "../NameManager.js";
import {TokenType as tt} from "../parser/tokenizer/types.js";
import type TokenProcessor from "../TokenProcessor.js";
import Transformer from "./Transformer.js";

export default class OptionalCatchBindingTransformer extends Transformer {
  constructor(readonly tokens: TokenProcessor, readonly nameManager: NameManager) {
    super();
  }

  process(): boolean {
    if (this.tokens.matches2(tt._catch, tt.braceL)) {
      this.tokens.copyToken();
      this.tokens.appendCode(` (${this.nameManager.claimFreeName("e")})`);
      return true;
    }
    return false;
  }
}
