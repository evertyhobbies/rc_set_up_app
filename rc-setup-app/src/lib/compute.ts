/**
 * Evaluates a template field's `formula` against the other values entered
 * for that setup, plus that car model's constants.
 *
 * A formula is a plain arithmetic expression referencing other field keys
 * by name, e.g.:
 *   "(spur / pinion) * internal_ratio"
 *   "(corner_weight_g.FL + corner_weight_g.FR)"
 *
 * Keeping formulas as data (stored per template_field, not hardcoded in
 * app logic) is what lets a future car with a different drivetrain calc —
 * or no computed transmission field at all — just be a different row,
 * with no code change here.
 */

export type ComputeContext = {
  // car/axle-scoped field key -> numeric value
  values: Record<string, number>;
  // corner-scoped field key -> per-corner numeric value
  cornerValues: Record<string, Partial<Record<"FL" | "FR" | "RL" | "RR", number>>>;
  // car-model-level constants, e.g. { internal_ratio: 1.9 }
  constants: Record<string, number>;
};

// Only allow characters a numeric expression could legitimately need.
// Blocks anything that could smuggle in arbitrary JS.
const SAFE_FORMULA = /^[a-zA-Z0-9_.\s+\-*/()]+$/;

export function evaluateFormula(
  formula: string,
  ctx: ComputeContext
): number | null {
  if (!SAFE_FORMULA.test(formula)) {
    throw new Error(`Formula contains disallowed characters: ${formula}`);
  }

  // Flatten cornerValues into dotted identifiers (e.g. corner_weight_g.FL)
  // so they can be referenced directly in the expression.
  const scope: Record<string, number> = { ...ctx.constants, ...ctx.values };
  for (const [key, corners] of Object.entries(ctx.cornerValues)) {
    for (const [corner, val] of Object.entries(corners)) {
      if (val !== undefined) scope[`${key}_${corner}`] = val;
    }
  }
  // Rewrite dotted corner references (key.FL) to the flattened form (key_FL)
  const rewritten = formula.replace(
    /([a-zA-Z_][a-zA-Z0-9_]*)\.(FL|FR|RL|RR)/g,
    "$1_$2"
  );

  const names = Object.keys(scope);
  const missing = names.filter((n) => scope[n] === undefined || Number.isNaN(scope[n]));
  // Missing inputs (not yet entered) resolve to null rather than throwing —
  // the UI shows a blank/dash until every input the formula needs is filled in.
  const referenced = rewritten.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  const unresolved = referenced.filter(
    (r) => !(r in scope) && !isKnownIdentifier(r)
  );
  if (unresolved.length > 0) return null;

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...names,
      `"use strict"; return (${rewritten});`
    );
    const result = fn(...names.map((n) => scope[n]));
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function isKnownIdentifier(_name: string) {
  return false;
}
