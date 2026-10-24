export function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

export function fraction(numerator: number, denominator = 1): string {
  if (denominator === 0) throw new Error("A fraction cannot have a zero denominator.");
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  const top = (sign * numerator) / divisor;
  const bottom = Math.abs(denominator) / divisor;
  return bottom === 1 ? `${top}` : `\\frac{${top}}{${bottom}}`;
}

export function signedTerm(value: number, variable = ""): string {
  if (value === 0) return "";
  const magnitude = Math.abs(value);
  const coefficient = variable && magnitude === 1 ? "" : `${magnitude}`;
  return `${value < 0 ? "-" : "+"}${coefficient}${variable}`;
}

export function linearExpression(coefficient: number, constant: number): string {
  const xTerm = coefficient === 1 ? "x" : coefficient === -1 ? "-x" : `${coefficient}x`;
  const constantTerm = signedTerm(constant);
  return `${xTerm}${constantTerm}`;
}

export function polynomialExpression(a: number, b: number, c: number): string {
  const leading = a === 1 ? "x^2" : a === -1 ? "-x^2" : `${a}x^2`;
  return `${leading}${signedTerm(b, "x")}${signedTerm(c)}`;
}

export function binomial(root: number): string {
  if (root === 0) return "x";
  return root > 0 ? `(x-${root})` : `(x+${Math.abs(root)})`;
}

