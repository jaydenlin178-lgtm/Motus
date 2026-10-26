import { toast } from "../ui.js";
import { t } from "../i18n.js";
import { update, newId } from "../store.js";
import { closeCamera } from "../capture/camera.js";
import { tappingStep } from "./steps/tapping.js";
import { tremorStep } from "./steps/tremor.js";

const STEPS = ["tap-right", "tap-left", "tremor"];
let draft = null;

function slimTapping(result)
{
    if (!result || !result.ok)
    {
        return null;
    }
    const slim = { rate: result.rate, meanAmplitude: result.meanAmplitude, decrementPct: result.decrementPct, intervalCv: result.intervalCv, pauses: result.pauses };
    return slim;
}

function slimTremor(phase)
{
    if (!phase)
    {
        return null;
    }
    const pick = (hand) => (hand ? { ok: hand.ok, detected: Boolean(hand.detected), amplitudeMm: hand.amplitudeMm, frequency: hand.frequency } : null);
    const slim = { right: pick(phase.right), left: pick(phase.left) };
    return slim;
}

export function trackCheckView(context)
{
    if (!draft || draft.done)
    {
        draft = { index: 0, right: null, left: null, tremor: null, done: false };
    }
    const step = STEPS[draft.index];
    const progress = { label: t("track.check"), right: (draft.index + 1) + " / " + STEPS.length, fraction: (draft.index + 1) / STEPS.length };
    const advance = () =>
    {
        if (draft.index >= STEPS.length - 1)
        {
            const record = { id: newId(), at: Date.now(), right: draft.right, left: draft.left, tremor: draft.tremor };
            update((state) =>
            {
                state.track.checks.push(record);
            });
            draft.done = true;
            closeCamera();
            toast(t("track.check.saved"));
            context.navigate("track");
            return;
        }
        draft.index++;
        context.rerender();
    };
    const isLast = draft.index === STEPS.length - 1;
    const common = { progress, onCleanup: context.onCleanup, nextLabel: isLast ? t("common.done") : null };
    context.onCleanup(() =>
    {
        if (window.location.hash !== "#/track/check")
        {
            closeCamera();
            if (!draft.done)
            {
                draft = null;
            }
        }
    });
    if (step === "tremor")
    {
        const options =
        {
            ...common,
            phases: ["rest"],
            title: t("track.step.tremor"),
            onDone: (results) =>
            {
                draft.tremor = slimTremor(results.rest);
                advance();
            },
            onSkip: () =>
            {
                advance();
            }
        };
        return tremorStep(options);
    }
    const side = step === "tap-right" ? "right" : "left";
    const options =
    {
        ...common,
        side,
        onDone: (result) =>
        {
            draft[side] = slimTapping(result);
            advance();
        },
        onSkip: () =>
        {
            advance();
        }
    };
    return tappingStep(options);
}
