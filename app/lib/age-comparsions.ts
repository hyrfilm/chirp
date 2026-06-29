// age-comparisons.ts

export interface User {
    age: number;
}

const MIN_CONSTRAINED_AGE = 18;
const MAX_CONSTRAINED_AGE = 80;

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
export function atLeastTwice(users: readonly User[]): boolean {
    if (users.length < 2) {
        return false;
    }

    let youngest = Number.POSITIVE_INFINITY;
    let oldest = Number.NEGATIVE_INFINITY;

    for (const { age } of users) {
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
export function exactlyTwice(users: readonly User[]): boolean {
    const encountered = new Set<number>();

    for (const { age } of users) {
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
 * Returns true when one distinct user's age is exactly twice another's.
 *
 * The supplied age range allows us to avoid lookups that cannot possibly
 * succeed:
 *
 * - An age above 40 cannot have a valid doubled partner within 18–80.
 * - An age below 36 cannot have a valid halved partner within 18–80.
 *
 * The specification constrains the age range but does not state that ages
 * are integers. For example, 75 is exactly twice 37.5. This implementation
 * therefore retains numeric Set lookups rather than using ages as array
 * indexes or relying on integer parity.
 *
 * If the domain were explicitly restricted to integer ages, a fixed-size
 * lookup table or bitset would also be a reasonable implementation.
 *
 * Time:  expected O(n)
 * Space: O(n), although the number of distinct valid numeric values is only
 *        bounded if the age precision is also constrained.
 */
export function constrainedExactlyTwice(
    users: readonly User[],
): boolean {
    const encountered = new Set<number>();

    for (const { age } of users) {
        const canHaveOlderPartner =
            age <= MAX_CONSTRAINED_AGE / 2;

        const canHaveYoungerPartner =
            age >= MIN_CONSTRAINED_AGE * 2;

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