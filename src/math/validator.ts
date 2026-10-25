import { ComputeEngine, isFunction, isNumber, type BoxedExpression } from "@cortex-js/compute-engine";
import type { Question, ValidationResult } from "../types";

const ce = new ComputeEngine();

function compact(value: string): string {
  return value
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/\\cdot/g, "")
    .replace(/\s+/g, "")
    .replace(/[{}]/g, "");
}

function parse(value: string, canonical = true): BoxedExpression | null {
  try {
    const expression = ce.parse(value, { form: canonical ? "canonical" : "structural" });
    if (!expression?.isValid || expression.has("Error")) return null;
    return expression;
  } catch {
    return null;
  }
}

function splitTuple(value: string): [string, string] | null {
  const cleaned = value
    .replace(/\\left|\\right/g, "")
    .replace(/^\s*[([]/, "")
    .replace(/[)\]]\s*$/, "");
  let depth = 0;
  for (let index = 0; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (character === "{" || character === "(" || character === "[") depth += 1;
    if (character === "}" || character === ")" || character === "]") depth -= 1;
    if (character === "," && depth === 0) {
      return [cleaned.slice(0, index), cleaned.slice(index + 1)];
    }
  }
  return null;
}

function equalExpressions(actual: string, expected: string): boolean {
  const actualExpression = parse(actual);
  const expectedExpression = parse(expected);
  if (!actualExpression || !expectedExpression) return false;
  return (
    actualExpression.isSame(expectedExpression) ||
    actualExpression.is(expectedExpression) ||
    actualExpression.isIdenticallyEqual(expectedExpression) === true
  );
}

function equalEquations(actual: string, expected: string): boolean {
  const actualExpression = parse(actual);
  const expectedExpression = parse(expected);
  if (
    !actualExpression ||
    !expectedExpression ||
    expectedExpression.operator !== "Equal" ||
    !isFunction(expectedExpression)
  ) {
    return false;
  }

  if (actualExpression.operator !== "Equal" || !isFunction(actualExpression)) {
    const expectedRight = expectedExpression.ops[1];
    return actualExpression.isIdenticallyEqual(expectedRight) === true || actualExpression.is(expectedRight);
  }

  const actualLeft = actualExpression.ops[0];
  const actualRight = actualExpression.ops[1];
  const expectedLeft = expectedExpression.ops[0];
  const expectedRight = expectedExpression.ops[1];

  if (actualLeft.isSame(expectedLeft)) {
    return actualRight.isIdenticallyEqual(expectedRight) === true || actualRight.is(expectedRight);
  }
  if (actualRight.isSame(expectedLeft)) {
    return actualLeft.isIdenticallyEqual(expectedRight) === true || actualLeft.is(expectedRight);
  }
  if (actualExpression.isSame(expectedExpression)) return true;

  const actualDifference = ce.box(["Subtract", actualLeft, actualRight]).simplify();
  const expectedDifference = ce.box(["Subtract", expectedLeft, expectedRight]).simplify();
  const variables = [...new Set([...actualDifference.freeVariables, ...expectedDifference.freeVariables])];
  let ratio: number | null = null;
  let samples = 0;

  for (let sample = 1; sample <= 7; sample += 1) {
    const substitution = Object.fromEntries(variables.map((variable, index) => [variable, sample * (index + 2) - 5]));
    const actualNumber = actualDifference.subs(substitution).N();
    const expectedNumber = expectedDifference.subs(substitution).N();
    if (!isNumber(actualNumber) || !isNumber(expectedNumber)) return false;
    const actualValue = actualNumber.re;
    const expectedValue = expectedNumber.re;
    if (!Number.isFinite(actualValue) || !Number.isFinite(expectedValue)) return false;
    if (Math.abs(expectedValue) < 1e-10) {
      if (Math.abs(actualValue) >= 1e-10) return false;
      continue;
    }
    const currentRatio = actualValue / expectedValue;
    if (!Number.isFinite(currentRatio) || Math.abs(currentRatio) < 1e-10) return false;
    if (ratio !== null && Math.abs(currentRatio - ratio) > 1e-9) return false;
    ratio = currentRatio;
    samples += 1;
  }

  return samples >= 2;
}

interface ParsedInterval {
  leftDelimiter: "(" | "[";
  leftEndpoint: string;
  rightEndpoint: string;
  rightDelimiter: ")" | "]";
  normalized: string;
}

function makeInterval(
  leftDelimiter: ParsedInterval["leftDelimiter"],
  leftEndpoint: string,
  rightEndpoint: string,
  rightDelimiter: ParsedInterval["rightDelimiter"]
): ParsedInterval | null {
  const left = leftEndpoint === "-∞" ? "-∞" : parse(leftEndpoint)?.simplify().latex;
  const right = rightEndpoint === "∞" ? "∞" : parse(rightEndpoint)?.simplify().latex;
  if (!left || !right) return null;
  return {
    leftDelimiter,
    leftEndpoint: left,
    rightEndpoint: right,
    rightDelimiter,
    normalized: `${leftDelimiter}${compact(left)},${compact(right)}${rightDelimiter}`
  };
}

function parseInterval(value: string): ParsedInterval | null {
  const cleaned = value
    .replace(/\\left|\\right/g, "")
    .replace(/\\lbrack/g, "[")
    .replace(/\\rbrack/g, "]")
    .replace(/\\lparen/g, "(")
    .replace(/\\rparen/g, ")")
    .replace(/\\infty/g, "∞")
    .replace(/\\,/g, "")
    .replace(/\s+/g, "")
    .replace(/\+∞/g, "∞");
  const match = cleaned.match(/^([([])(.+),(.+)([)\]])$/);
  if (match) {
    return makeInterval(
      match[1] as ParsedInterval["leftDelimiter"],
      match[2],
      match[3],
      match[4] as ParsedInterval["rightDelimiter"]
    );
  }

  const relation = parse(value, false);
  if (!relation || !isFunction(relation) || relation.ops.length !== 2) return null;
  const [leftOperand, rightOperand] = relation.ops;
  const leftIsX = compact(leftOperand.latex) === "x";
  const rightIsX = compact(rightOperand.latex) === "x";
  if (leftIsX === rightIsX) return null;
  const boundary = compact((leftIsX ? rightOperand : leftOperand).simplify().latex);
  const operator = relation.operator;
  const lowerBounded = leftIsX ? operator === "Greater" || operator === "GreaterEqual" : operator === "Less" || operator === "LessEqual";
  const inclusive = operator === "GreaterEqual" || operator === "LessEqual";
  if (!["Greater", "GreaterEqual", "Less", "LessEqual"].includes(operator)) return null;
  return lowerBounded
    ? makeInterval(inclusive ? "[" : "(", boundary, "∞", ")")
    : makeInterval("(", "-∞", boundary, inclusive ? "]" : ")");
}

function equalIntervalEndpoints(actual: string, expected: string): boolean {
  if (actual === "-∞" || actual === "∞" || expected === "-∞" || expected === "∞") {
    return actual === expected;
  }
  return equalExpressions(actual, expected);
}

function equalIntervals(actual: ParsedInterval, expected: ParsedInterval): boolean {
  return (
    actual.leftDelimiter === expected.leftDelimiter &&
    actual.rightDelimiter === expected.rightDelimiter &&
    equalIntervalEndpoints(actual.leftEndpoint, expected.leftEndpoint) &&
    equalIntervalEndpoints(actual.rightEndpoint, expected.rightEndpoint)
  );
}

export function isParseableAnswer(question: Question, latex: string): boolean {
  if (!latex.trim()) return false;
  if (question.answer.kind === "ordered_pair") {
    const tuple = splitTuple(latex);
    return Boolean(tuple && parse(tuple[0]) && parse(tuple[1]));
  }
  if (question.answer.kind === "interval") return parseInterval(latex) !== null;
  return parse(latex) !== null;
}

export function validateAnswer(question: Question, latex: string): ValidationResult {
  if (!isParseableAnswer(question, latex)) {
    return {
      parseable: false,
      correct: false,
      normalizedAnswer: "",
      feedback: "Check the answer format. The math field needs a complete expression.",
      retryEligible: true
    };
  }

  let correct = false;
  let normalizedAnswer = latex;

  if (question.answer.kind === "ordered_pair") {
    const actual = splitTuple(latex)!;
    const expected = splitTuple(question.answer.latex)!;
    correct = equalExpressions(actual[0], expected[0]) && equalExpressions(actual[1], expected[1]);
    normalizedAnswer = `(${parse(actual[0])!.simplify().latex},${parse(actual[1])!.simplify().latex})`;
  } else if (question.answer.kind === "interval") {
    const actualInterval = parseInterval(latex)!;
    const expectedInterval = parseInterval(question.answer.latex)!;
    normalizedAnswer = actualInterval.normalized;
    const closesInfinity =
      (actualInterval.leftEndpoint === "-∞" && actualInterval.leftDelimiter === "[") ||
      (actualInterval.rightEndpoint === "∞" && actualInterval.rightDelimiter === "]");
    if (closesInfinity) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "Infinity is never included. Use a parenthesis next to infinity.",
        retryEligible: true
      };
    }
    correct = equalIntervals(actualInterval, expectedInterval);
  } else if (question.answer.kind === "equation") {
    correct = equalEquations(latex, question.answer.latex);
    normalizedAnswer = parse(latex)!.latex;
  } else {
    correct = equalExpressions(latex, question.answer.latex);
    normalizedAnswer = parse(latex)!.simplify().latex;
  }

  if (correct && question.answer.requiresFactoredForm) {
    const raw = parse(latex, false);
    correct = Boolean(
      (raw?.operator === "Multiply" || raw?.operator === "InvisibleOperator") &&
        isFunction(raw) &&
        raw.ops.filter((operand) => operand.freeVariables.includes("x")).length >= 2
    );
    if (!correct) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "The expression is equivalent, but this question asks for factored form.",
        retryEligible: true
      };
    }
  }

  if (correct && question.answer.forbiddenFactorLatex) {
    const forbidden = compact(question.answer.forbiddenFactorLatex);
    if (compact(latex).includes(forbidden)) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "The value is equivalent, but the common factor still needs to be cancelled.",
        retryEligible: true
      };
    }
  }

  return {
    parseable: true,
    correct,
    normalizedAnswer,
    feedback: correct ? "Correct. Your final answer is equivalent." : "Not yet. Keep your work on paper and check the final expression.",
    retryEligible: !correct
  };
}

