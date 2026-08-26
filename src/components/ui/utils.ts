/**
 * Minimal classnames joiner — deliberately dependency-free so the design
 * system doesn't add a package.json dependency from a parallel file scope.
 * Accepts strings, falsy values (skipped), and nested arrays.
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cx(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue) => {
    // Skip every falsy value, including 0 — cx(count && "badge--alert") must not emit a
    // literal "0" class when count is 0, matching clsx's falsy-value convention.
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(String(value));
  };

  inputs.forEach(walk);
  return out.join(" ");
}
