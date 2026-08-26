/**
 * Decorative topographic contour lines — Rivalys' visual signature.
 *
 * The product's whole premise is spatial: "see where you're losing ground."
 * These nested, hand-irregular rings read as elevation contours on a survey
 * map — the terrain the product is about. Stroke-only, currentColor, so
 * callers set color + opacity via className.
 */
export function ContourMarks({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M203,46 C256,49 292,78 312,120 C332,162 331,214 306,255 C282,296 240,323 194,326 C148,329 104,309 79,271 C54,233 51,182 73,140 C93,101 121,58 168,47 C179,44 192,45 203,46 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.9"
      />
      <path
        d="M199,80 C240,82 269,105 285,138 C302,172 300,212 280,244 C261,276 227,297 190,299 C154,301 119,285 100,255 C81,225 79,186 97,153 C114,121 137,88 175,80 C183,78 191,79 199,80 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.75"
      />
      <path
        d="M196,113 C227,115 249,133 261,157 C274,182 272,211 257,234 C242,257 216,272 189,273 C162,274 136,262 122,240 C108,218 107,189 121,166 C134,143 152,119 180,113 C185,112 191,112 196,113 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.6"
      />
      <path
        d="M192,146 C213,147 228,159 236,175 C244,192 242,211 232,225 C222,239 205,248 188,248 C170,249 153,241 144,226 C135,212 134,193 144,178 C153,163 165,147 184,145 C187,145 190,145 192,146 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.45"
      />
      <circle cx="188" cy="196" r="4" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
