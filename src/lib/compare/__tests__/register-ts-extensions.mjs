// Node's native TypeScript support requires explicit file extensions on relative imports
// (unlike tsc's "bundler" moduleResolution used by this project, which infers them) —
// so `import { x } from "../score"` in a .test.ts file fails to resolve when the file is
// run directly by `node --test`, even though it type-checks fine and works under Next.js.
//
// This is a self-contained fix scoped to the compare test suite only: it does not touch
// tsconfig.json (adding `allowImportingTsExtensions` there would let source files import
// with an explicit ".ts" suffix, which `tsc --noEmit` then also accepts — but it's a
// project-wide config change outside this feature's file scope). Instead, this hook makes
// Node try the sibling ".ts" file whenever an extensionless relative specifier doesn't
// resolve on its own, leaving every other import path untouched.
//
// Usage:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs \
//        --test src/lib/compare/__tests__/*.test.ts

import { registerHooks } from "node:module";

const EXTENSIONLESS_RELATIVE_SPECIFIER = /^\.{1,2}\//;
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (EXTENSIONLESS_RELATIVE_SPECIFIER.test(specifier) && !HAS_EXTENSION.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // Not a .ts sibling (e.g. resolves some other way) — fall through below.
      }
    }
    return nextResolve(specifier, context);
  },
});
