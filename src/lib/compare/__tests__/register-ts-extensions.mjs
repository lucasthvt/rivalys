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

// Second gap, found when testing public-teardown.ts: the "@/..." path alias from
// tsconfig.json is invisible to Node. Type-only "@/..." imports never showed the problem
// because TypeScript erases them before Node ever sees a specifier; the first module under
// test to import a *value* through the alias fails outright. Mapping the alias here keeps
// the fix in the same place as the extension fix, rather than reshaping source files to
// suit the test runner.

import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const EXTENSIONLESS_RELATIVE_SPECIFIER = /^\.{1,2}\//;
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;
const PATH_ALIAS = /^@\//;

// Mirrors "paths": { "@/*": ["./src/*"] } in tsconfig.json. Resolved from the working
// directory, which is the repo root for every documented way of running these tests.
const SRC_ROOT = resolvePath(process.cwd(), "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (PATH_ALIAS.test(specifier)) {
      const asPath = resolvePath(SRC_ROOT, specifier.slice(2));
      const url = pathToFileURL(asPath).href;
      // Same extensionless dance as below: the alias points at a .ts source too.
      if (!HAS_EXTENSION.test(specifier)) {
        try {
          return nextResolve(`${url}.ts`, context);
        } catch {
          // Fall through: could be a directory index or an already-built file.
        }
      }
      return nextResolve(url, context);
    }

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
