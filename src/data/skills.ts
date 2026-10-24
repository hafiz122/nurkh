import type { SkillDefinition, SkillId } from "../types";

export const skills: SkillDefinition[] = [
  {
    id: "expressions",
    title: "Expressions",
    shortTitle: "Expressions",
    description: "Collect like terms, distribute factors, and evaluate expressions.",
    prerequisites: []
  },
  {
    id: "linear",
    title: "Equations & inequalities",
    shortTitle: "Linear",
    description: "Solve one-variable equations and write inequality solution intervals.",
    prerequisites: ["expressions"]
  },
  {
    id: "lines_systems",
    title: "Lines & systems",
    shortTitle: "Lines",
    description: "Find line equations and solve two-variable systems.",
    prerequisites: ["linear"]
  },
  {
    id: "exponents_radicals",
    title: "Exponents & radicals",
    shortTitle: "Powers",
    description: "Apply exponent laws and simplify exact radicals.",
    prerequisites: ["expressions"]
  },
  {
    id: "polynomials",
    title: "Polynomials",
    shortTitle: "Polynomials",
    description: "Add, multiply, and simplify polynomial expressions.",
    prerequisites: ["expressions", "exponents_radicals"]
  },
  {
    id: "factoring_quadratics",
    title: "Factoring & quadratics",
    shortTitle: "Quadratics",
    description: "Factor quadratics and solve for their real roots.",
    prerequisites: ["polynomials"]
  },
  {
    id: "rational",
    title: "Rational expressions",
    shortTitle: "Rational",
    description: "Simplify rational expressions and solve rational equations.",
    prerequisites: ["factoring_quadratics"]
  },
  {
    id: "functions",
    title: "Functions",
    shortTitle: "Functions",
    description: "Evaluate, compose, and interpret function rules.",
    prerequisites: ["linear", "polynomials"]
  }
];

export const skillIds = skills.map((skill) => skill.id);

export function getSkill(id: SkillId): SkillDefinition {
  const skill = skills.find((item) => item.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

