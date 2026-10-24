import { describe, expect, it } from "vitest";
import { skillIds } from "../src/data/skills";
import { generators } from "../src/math/generators";
import type { Difficulty } from "../src/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

describe("deterministic question generators", () => {
  for (const skillId of skillIds) {
    for (const difficulty of difficulties) {
      it(`${skillId} ${difficulty} is reproducible and solvable across 1,000 seeds`, () => {
        const generator = generators[skillId];

        for (let seed = 1; seed <= 1_000; seed += 1) {
          const first = generator.generate(seed, difficulty);
          const second = generator.generate(seed, difficulty);

          expect(second).toEqual(first);
          expect(first.id).toBe(`${skillId}:${difficulty}:${seed}`);
          expect(first.seed).toBe(seed);
          expect(first.generatorVersion).toBe(1);
          expect(first.promptLatex).not.toMatch(/NaN|Infinity|undefined/);
          expect(first.answer.latex).not.toMatch(/NaN|Infinity|undefined/);
          expect(first.hints.length).toBeGreaterThan(0);
          expect(first.workedSolution.length).toBeGreaterThan(0);

          const result = generator.validate(first, first.answer.latex);
          expect(result.parseable, `${first.id} answer should parse`).toBe(true);
          expect(result.correct, `${first.id} should accept its exact answer ${first.answer.latex}`).toBe(true);
        }
      });
    }
  }
});
