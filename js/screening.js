import { collectFlags } from "./analysis/flags.js";

export const QUESTIONS =
[
    { key: "dreams", options: ["yes", "no", "unsure"], marker: "rbdQuestionnaire" },
    { key: "smell", options: ["yes", "no", "unsure"], marker: null },
    { key: "constipation", options: ["yes", "no", "unsure"], marker: "constipation" },
    { key: "sleepiness", options: ["yes", "no", "unsure"], marker: "daytimeSomnolence" },
    { key: "dizziness", options: ["yes", "no", "unsure"], marker: "symptomaticHypotension" },
    { key: "urinary", options: ["yes", "no", "unsure"], marker: "urinaryDysfunction" },
    { key: "mood", options: ["yes", "no", "unsure"], marker: "depression" },
    { key: "family", options: ["yes", "no", "unsure"], marker: "familyHistory" },
    { key: "pesticides", options: ["yes", "no", "unsure"], marker: "pesticides" },
    { key: "solvents", options: ["yes", "no", "unsure"], marker: "solvents" },
    { key: "caffeine", options: ["yes", "no", "unsure"], marker: "caffeine" },
    { key: "smoking", options: ["never", "former", "current", "unsure"], marker: "smoking" },
    { key: "activity", options: ["yes", "no", "unsure"], marker: "inactivity" },
    { key: "diabetes", options: ["yes", "no", "unsure"], marker: "diabetes" }
];

export const MARKERS =
{
    rbdQuestionnaire: { positive: 2.8, negative: 0.89 },
    constipation: { positive: 2.5, negative: 0.82 },
    daytimeSomnolence: { positive: 2.7, negative: 0.86 },
    symptomaticHypotension: { positive: 3.2, negative: 0.8 },
    urinaryDysfunction: { positive: 2.0, negative: 0.9 },
    depression: { positive: 1.6, negative: 0.88 },
    familyHistory: { positive: 2.5, negative: 1 },
    pesticides: { positive: 1.5, negative: 1 },
    solvents: { positive: 1.5, negative: 1 },
    diabetes: { positive: 1.5, negative: 0.97 },
    inactivity: { positive: 1.3, negative: 0.91 },
    motorTesting: { positive: 3.5, negative: 0.6 }
};

export const CAFFEINE = { nonuse: 1.35, use: 0.88 };
export const SMOKING = { never: 1.2, former: 0.91, current: 0.51 };
export const SEX = { male: 1.2, female: 0.8 };

export const PRIORS =
[
    { from: 50, to: 54, probability: 0.004 },
    { from: 55, to: 59, probability: 0.0075 },
    { from: 60, to: 64, probability: 0.0125 },
    { from: 65, to: 69, probability: 0.02 },
    { from: 70, to: 74, probability: 0.025 },
    { from: 75, to: 79, probability: 0.035 },
    { from: 80, to: 200, probability: 0.04 }
];

export const TIERS = { possible: 0.3, minimumElevated: 0.05, prodromalMinimum: 14 };

const PRODROMAL = new Set(["dreams", "constipation", "sleepiness", "dizziness", "urinary", "mood", "motor"]);

export function priorForAge(age)
{
    const band = PRIORS.find((entry) => age >= entry.from && age <= entry.to);
    return band ? band.probability : null;
}

function binaryFactor(answer, marker, key)
{
    if (answer !== "yes" && answer !== "no")
    {
        return null;
    }
    const table = MARKERS[marker];
    const lr = answer === "yes" ? table.positive : table.negative;
    if (lr === 1)
    {
        return null;
    }
    const factor = { id: key, labelKey: "factor." + key + "." + answer, lr };
    return factor;
}

export function screeningFactors(screening, motor)
{
    const factors = [];
    const answers = screening.answers || {};
    if (screening.sex === "male" || screening.sex === "female")
    {
        factors.push({ id: "sex", labelKey: "factor.sex." + screening.sex, lr: SEX[screening.sex] });
    }
    for (const question of QUESTIONS)
    {
        const answer = answers[question.key];
        if (!question.marker)
        {
            continue;
        }
        if (question.marker === "caffeine")
        {
            if (answer === "yes" || answer === "no")
            {
                factors.push({ id: "caffeine", labelKey: "factor.caffeine." + answer, lr: answer === "yes" ? CAFFEINE.use : CAFFEINE.nonuse });
            }
            continue;
        }
        if (question.marker === "smoking")
        {
            if (SMOKING[answer])
            {
                factors.push({ id: "smoking", labelKey: "factor.smoking." + answer, lr: SMOKING[answer] });
            }
            continue;
        }
        if (question.marker === "inactivity")
        {
            if (answer === "yes" || answer === "no")
            {
                const inactive = answer === "no";
                factors.push({ id: "activity", labelKey: "factor.activity." + answer, lr: inactive ? MARKERS.inactivity.positive : MARKERS.inactivity.negative });
            }
            continue;
        }
        const factor = binaryFactor(answer, question.marker, question.key);
        if (factor)
        {
            factors.push(factor);
        }
    }
    if (motor && motor.status === "positive")
    {
        factors.push({ id: "motor", labelKey: "factor.motor.yes", labelParams: { n: motor.abnormal, total: motor.completed }, lr: MARKERS.motorTesting.positive });
    }
    else if (motor && motor.status === "negative")
    {
        factors.push({ id: "motor", labelKey: "factor.motor.no", labelParams: { total: motor.completed }, lr: MARKERS.motorTesting.negative });
    }
    return factors;
}

export function posteriorProbability(prior, factors)
{
    let odds = prior / (1 - prior);
    for (const factor of factors)
    {
        odds *= factor.lr;
    }
    return odds / (1 + odds);
}

export function prodromalStrength(factors)
{
    return factors.filter((factor) => PRODROMAL.has(factor.id) && factor.lr > 1).reduce((product, factor) => product * factor.lr, 1);
}

export function computeScreening(screening)
{
    const motor = collectFlags(screening.results || {});
    const factors = screeningFactors(screening, motor);
    const notes = [];
    if ((screening.answers || {}).smell === "yes")
    {
        notes.push({ labelKey: "factor.smell.yes", noteKey: "results.smellNote" });
    }
    if (motor.status === "borderline")
    {
        notes.push({ labelKey: "factor.motor.borderline", labelParams: { n: motor.abnormal, total: motor.completed }, noteKey: "results.motorBorderline" });
    }
    const prior = priorForAge(screening.age);
    if (prior === null)
    {
        const motorOnly =
        {
            mode: "motor",
            tier: motor.positive ? 2 : 1,
            motor,
            factors: [],
            raised: [],
            lowered: [],
            notes,
            priorPct: NaN,
            posteriorPct: NaN,
            prodromal: NaN
        };
        return motorOnly;
    }
    const posterior = posteriorProbability(prior, factors);
    const prodromal = prodromalStrength(factors);
    let tier = 1;
    if (posterior >= TIERS.possible && prodromal >= TIERS.prodromalMinimum)
    {
        tier = 3;
    }
    else if (posterior >= Math.max(TIERS.minimumElevated, 2 * prior))
    {
        tier = 2;
    }
    const byStrength = (a, b) => Math.abs(Math.log(b.lr)) - Math.abs(Math.log(a.lr));
    const summary =
    {
        mode: "risk",
        tier,
        motor,
        factors: factors.slice().sort(byStrength),
        raised: factors.filter((f) => f.lr > 1).sort(byStrength),
        lowered: factors.filter((f) => f.lr < 1).sort(byStrength),
        notes,
        priorPct: prior * 100,
        posteriorPct: posterior * 100,
        prodromal
    };
    return summary;
}
