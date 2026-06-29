import { describe, expect, it } from "vitest";
import fc from "fast-check";

const MIN_TEST_AGE = 18;
const MAX_TEST_AGE = 80;

import {
    atLeastTwice,
    constrainedExactlyTwice,
    exactlyTwice,
} from "lib/age-comparisons";
type User = { age: number };

// this results in 50,000 permutations of these tests are run
fc.configureGlobal({ numRuns: 50_000 });

function bruteForceAtLeastTwice(
    users: readonly User[],
): boolean {
    return users.some((first, firstIndex) =>
        users.some(
            (second, secondIndex) =>
                firstIndex !== secondIndex &&
                first.age >= second.age * 2,
        ),
    );
}

function bruteForceExactlyTwice(
    users: readonly User[],
): boolean {
    return users.some((first, firstIndex) =>
        users.some(
            (second, secondIndex) =>
                firstIndex !== secondIndex &&
                first.age === second.age * 2,
        ),
    );
}

describe("atLeastTwice", () => {
    it("returns false for fewer than two users", () => {
        expect(atLeastTwice([])).toBe(false);
        expect(atLeastTwice([{ age: 40 }])).toBe(false);
    });

    it("finds an age that is at least twice another", () => {
        expect(
            atLeastTwice([
                { age: 20 },
                { age: 41 },
                { age: 30 },
            ]),
        ).toBe(true);
    });

    it("returns false when no such pair exists", () => {
        expect(
            atLeastTwice([
                { age: 30 },
                { age: 40 },
                { age: 50 },
            ]),
        ).toBe(false);
    });
});

describe("exactlyTwice", () => {
    it("works regardless of encounter order", () => {
        expect(
            exactlyTwice([{ age: 20 }, { age: 40 }]),
        ).toBe(true);

        expect(
            exactlyTwice([{ age: 40 }, { age: 20 }]),
        ).toBe(true);
    });

    it("supports non-integer ages", () => {
        expect(
            exactlyTwice([{ age: 37.5 }, { age: 75 }]),
        ).toBe(true);

        expect(
            exactlyTwice([{ age: 75 }, { age: 37.5 }]),
        ).toBe(true);
    });

    it("does not match a user with itself", () => {
        expect(exactlyTwice([{ age: 40 }])).toBe(false);
    });

    it("returns false without an exact match", () => {
        expect(
            exactlyTwice([{ age: 20 }, { age: 41 }]),
        ).toBe(false);
    });
});

describe("constrainedExactlyTwice", () => {
    it("works regardless of encounter order", () => {
        expect(
            constrainedExactlyTwice([
                { age: 20 },
                { age: 40 },
            ]),
        ).toBe(true);

        expect(
            constrainedExactlyTwice([
                { age: 40 },
                { age: 20 },
            ]),
        ).toBe(true);
    });

    it("supports fractional ages within the constrained range", () => {
        expect(
            constrainedExactlyTwice([
                { age: 37.5 },
                { age: 75 },
            ]),
        ).toBe(true);

        expect(
            constrainedExactlyTwice([
                { age: 75 },
                { age: 37.5 },
            ]),
        ).toBe(true);
    });

    it("returns false when the only possible partner is outside the range", () => {
        expect(
            constrainedExactlyTwice([
                { age: 50 },
                { age: 70 },
            ]),
        ).toBe(false);
    });
});

describe("property tests", () => {
    const generalUserArray = fc.array(
        fc.record({
            age: fc.integer({
                min: 1,
                max: 120,
            }),
        }),
        { maxLength: 200 },
    );

    const constrainedUserArray = fc.array(
        fc.record({
            age: fc.integer({
                min: MIN_TEST_AGE,
                max: MAX_TEST_AGE,
            }),
        }),
        { maxLength: 200 },
    );

    it("atLeastTwice agrees with the brute-force implementation", () => {
        fc.assert(
            fc.property(generalUserArray, users => {
                expect(atLeastTwice(users)).toBe(
                    bruteForceAtLeastTwice(users),
                );
            }),
        );
    });

    it("exactlyTwice agrees with the brute-force implementation", () => {
        fc.assert(
            fc.property(generalUserArray, users => {
                expect(exactlyTwice(users)).toBe(
                    bruteForceExactlyTwice(users),
                );
            }),
        );
    });

    it("constrainedExactlyTwice agrees with the brute-force implementation", () => {
        fc.assert(
            fc.property(constrainedUserArray, users => {
                expect(constrainedExactlyTwice(users)).toBe(
                    bruteForceExactlyTwice(users),
                );
            }),
        );
    });
});
