type WithAge = { age: number };
type AgeValidator = (age: number) => void;

const MIN_AGE = 18;
const MAX_AGE = 80;

function assertValidAge(age: number): void {
    if (!Number.isFinite(age)) {
        throw new Error(`Age needs to be an integer: received: ${age}`);
    }
    // we allow for ages like 37 / 2 = 18.5, so if we double the age we can safely say that if
    // it's an integer it's valid otherwise not
    if (!Number.isSafeInteger(age * 2)) {
        throw new RangeError(
            `Age must use half-year increments; received ${age}`,
        );
    }
    if (age < 0) {
        throw new RangeError(
            `Age cannot be negative; received ${age}`,
        );
    }
}

function assertConstrainedAge(age: number): void {
    if (age < MIN_AGE || age > MAX_AGE) {
        throw new RangeError(
            `Age must be between ${MIN_AGE} and ${MAX_AGE}; received ${age}`,
        );
    }
}

function assertAges(
    ...validators: readonly AgeValidator[]
) {
    return (users: readonly WithAge[]): void => {
        for (const { age } of users) {
            for (const validate of validators) {
                validate(age);
            }
        }
    };
}

const validateIntegerAges = assertAges(assertValidAge);
const validateConstrainedAges = assertAges(assertValidAge, assertConstrainedAge);

/**
 * Returns true when one distinct user is at least twice as old as another.
 *
 * For positive ages, only the youngest and oldest users can determine
 * the answer:
 *
 *   oldest >= youngest * 2
 *
 * Time:  O(n)
 * Space: O(1)
 */
export function atLeastTwice(users: readonly WithAge[]): boolean {
    validateIntegerAges(users);
    if (users.length < 2) {
        return false;
    }

    let youngest = Number.POSITIVE_INFINITY;
    let oldest = 0;

    for (const {age} of users) {
        youngest = Math.min(youngest, age);
        oldest = Math.max(oldest, age);
    }

    return oldest >= youngest * 2;
}

/**
 * Returns true when one distinct user's age is exactly twice another's.
 *
 * Previously encountered ages are stored directly. For each new age,
 * either its double or its half may already have been encountered.
 *
 * This checks both possibilities, so the result does not depend on the
 * order of the users.
 *
 * Time:  expected O(n)
 * Space: O(n)
 */
export function exactlyTwice(users: readonly WithAge[]): boolean {
    validateIntegerAges(users);

    const encountered = new Set<number>();

    for (const {age} of users) {
        if (
            encountered.has(age * 2) ||
            encountered.has(age / 2)
        ) {
            return true;
        }

        encountered.add(age);
    }

    return false;
}

/**
 * Returns true when one user's age is exactly twice another's.
 *
 * Time: expected O(n) (one pass through the array)
 * Space: O(1), because validated integer ages are restricted to the fixed
 * domain 18–80. (pedantically, since we allow 18.5 19.5 as well,
 * the domain could be up to 160 values)
 *
 * Design note:
 * The bounded domain permits a fixed lookup table indexed by age. This
 * implementation deliberately retains a Set<number> instead.
 *
 Both representations have bounded auxiliary storage once the integer and
 range invariants are enforced. A table would therefore provide only a
 constant-factor reduction in allocation and lookup overhead—at most a few
 hundred bytes here—while introducing an additional encoded representation
 of the domain.

 For correctness-critical software, I prefer to keep domain values represented
 directly unless profiling demonstrates that a more specialised encoding is
 necessary. Optimisations that depend on domain invariants should follow from
 explicit, validated, and thoroughly tested contracts rather than introduce
 implicit assumptions for negligible practical gain.
 */
export function constrainedExactlyTwice(
    users: readonly WithAge[],
): boolean {
    validateConstrainedAges(users);

    const encountered = new Set<number>();

    for (const {age} of users) {
        const canHaveOlderPartner =
            age <= MAX_AGE / 2;

        const canHaveYoungerPartner =
            age >= MIN_AGE * 2;

        if (
            (canHaveOlderPartner && encountered.has(age * 2)) ||
            (canHaveYoungerPartner && encountered.has(age / 2))
        ) {
            return true;
        }

        encountered.add(age);
    }

    return false;
}