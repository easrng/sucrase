import type {Transform} from "../src/index.js";
import {assertResult} from "./util.js";

const freeIt = it;
for (const transforms of [[], ["typescript"], ["flow"]] satisfies Array<[Transform?]>) {
  describe(`esm rewriting (${transforms[0] || "vanilla"})`, () => {
    freeIt("rewrites dynamic imports", () => {
      assertResult(
        `
      console.log(await import("dynamic"), await import(String("dynamic")))
      console.log(({import(){}}).import())
      console.log(import.meta.url)
      `,
        ` function _dynamicImport(specifier){return import(\`/@dyn?s=\${encodeURIComponent(specifier)}&p=\${encodeURIComponent(import.meta.url)}\`)}
      console.log(await _dynamicImport("dynamic"), await _dynamicImport(String("dynamic")))
      console.log(({import(){}}).import())
      console.log(import.meta.url)
      `,
        {
          transforms,
          disableESTransforms: true,
          dynamicImportFunction: `return import(\`/@dyn?s=\${encodeURIComponent(specifier)}&p=\${encodeURIComponent(import.meta.url)}\`)`,
          keepUnusedImports: true,
        },
      );
    });
    freeIt("rewrites static imports", () => {
      assertResult(
        `
      import "static"
      import * as a from "static"
      import b, * as c from "static"
      import d, {e, a as f} from "static"
      import g from "static"
      `,
        `
      import "rewrite"
      import * as a from "rewrite"
      import b, * as c from "rewrite"
      import d, {e, a as f} from "rewrite"
      import g from "rewrite"
      `,
        {
          transforms,
          disableESTransforms: true,
          rewriteImportSpecifier(specifier) {
            return '"rewrite"';
          },
          keepUnusedImports: true,
        },
      );
    });
    freeIt("rewrites static reexports", () => {
      assertResult(
        `
      export * as a from "static"
      export * from "static"
      export { e, a as f } from "static"
      export { default as b } from "static"
      export { a }
      export const a = b
      `,
        `
      export * as a from "rewrite"
      export * from "rewrite"
      export { e, a as f } from "rewrite"
      export { default as b } from "rewrite"
      export { a }
      export const a = b
      `,
        {
          transforms,
          disableESTransforms: true,
          rewriteImportSpecifier(specifier) {
            return '"rewrite"';
          },
          keepUnusedImports: true,
        },
      );
    });
  });
}
