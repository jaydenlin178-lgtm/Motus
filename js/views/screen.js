import { h } from "../ui.js";
import { icon } from "../icons.js";
import { t } from "../i18n.js";
import { speak } from "../speech.js";
import { unlockAudio } from "../sound.js";
import { getState, update, startScreening, finishScreening } from "../store.js";
import { QUESTIONS } from "../screening.js";
import { closeCamera } from "../capture/camera.js";
import { closeMicrophone } from "../capture/audio.js";
import { progressBar, stickyActions, button } from "./steps/common.js";
import { tappingStep } from "./steps/tapping.js";
import { tremorStep } from "./steps/tremor.js";
import { faceStep } from "./steps/face.js";
import { voiceStep } from "./steps/voice.js";
import { spiralStep } from "./steps/spiral.js";

const TEST_STEPS = ["tap-right", "tap-left", "tremor", "face", "voice", "spiral-first", "spiral-second"];

function allSteps()
{
    const steps = ["about"];
    QUESTIONS.forEach((_, i) => steps.push("q" + i));
    steps.push("tests");
    return steps.concat(TEST_STEPS);
}

function setStep(step)
{
    update((draft) =>
    {
        draft.screening.step = step;
    });
}

function choiceList(options, selected, onChoose, inline)
{
    return h("div", { class: inline ? "choices is-inline" : "choices", role: "radiogroup" }, options.map((option) =>
        h("button",
        {
            class: "choice",
            type: "button",
            role: "radio",
            "aria-checked": selected === option.value ? "true" : "false",
            onClick: () => onChoose(option.value)
        }, h("span", { class: "choice-mark" }, icon("check")), h("span", null, option.label))));
}

function aboutStep(context, advance)
{
    const screening = getState().screening;
    let sex = screening.sex;
    let hand = getState().settings.dominant || "right";
    const ageInput = h("input", { class: "text-input", id: "age", type: "number", inputmode: "numeric", min: "18", max: "110", value: screening.age || "", autocomplete: "off" });
    const ageError = h("p", { class: "quiet small", role: "alert" }, "");
    const sexGroup = h("div");
    const handGroup = h("div");
    const renderSex = () =>
    {
        sexGroup.replaceChildren(choiceList(
        [
            { value: "male", label: t("screen.about.male") },
            { value: "female", label: t("screen.about.female") },
            { value: "unspecified", label: t("screen.about.preferNot") }
        ], sex, (value) =>
        {
            sex = value;
            renderSex();
        }));
    };
    const renderHand = () =>
    {
        handGroup.replaceChildren(choiceList(
        [
            { value: "right", label: t("common.right") },
            { value: "left", label: t("common.left") }
        ], hand, (value) =>
        {
            hand = value;
            renderHand();
        }, true));
    };
    renderSex();
    renderHand();
    const proceed = () =>
    {
        unlockAudio();
        const age = Number(ageInput.value);
        if (!Number.isFinite(age) || age < 18 || age > 110)
        {
            ageError.textContent = t("screen.about.ageError");
            ageInput.focus();
            return;
        }
        update((draft) =>
        {
            draft.screening.age = Math.round(age);
            draft.screening.sex = sex || "unspecified";
            draft.settings.dominant = hand;
        });
        advance();
    };
    speak(t("screen.about.title"));
    return h("div", { class: "stack-loose" },
        h("h1", null, t("screen.about.title")),
        h("div", { class: "field" },
            h("label", { for: "age" }, t("screen.about.age")),
            ageInput,
            h("p", { class: "quiet small" }, t("screen.about.ageHint")),
            ageError),
        h("fieldset", { class: "field" }, h("legend", null, t("screen.about.sex")), sexGroup),
        h("fieldset", { class: "field" }, h("legend", null, t("screen.about.hand")), handGroup),
        stickyActions(button(t("common.continue"), proceed)));
}

function questionIntro()
{
    const parts = t("screen.questions.intro").split("{unsure}");
    return h("p", { class: "quiet question-intro" }, parts[0], h("strong", null, t("common.unsure")), parts[1] || "");
}

function questionStep(index, advance, back)
{
    const question = QUESTIONS[index];
    let selected = getState().screening.answers[question.key] || null;
    const options = question.options.map((value) => ({ value, label: t(value === "yes" ? "common.yes" : value === "no" ? "common.no" : value === "unsure" ? "common.unsure" : "q." + question.key + "." + value) }));
    const holder = h("div");
    const hint = h("p", { class: "quiet small", role: "alert" }, "");
    const continueButton = button(t("common.continue"), () =>
    {
        if (!selected)
        {
            hint.textContent = t("screen.questions.pick");
            return;
        }
        update((draft) =>
        {
            draft.screening.answers[question.key] = selected;
        });
        advance();
    });
    const renderChoices = () =>
    {
        holder.replaceChildren(choiceList(options, selected, (value) =>
        {
            selected = value;
            hint.textContent = "";
            renderChoices();
        }));
        continueButton.classList.toggle("is-waiting", !selected);
    };
    renderChoices();
    const text = t("q." + question.key);
    speak(text);
    return h("div", { class: "stack-loose" },
        h("div", null,
            h("button", { class: "back-link", type: "button", onClick: back }, icon("back"), t("nav.back")),
            progressBar({ label: t("screen.progress.question", { n: index + 1, total: QUESTIONS.length }), fraction: (index + 1) / QUESTIONS.length }),
            index === 0 ? questionIntro() : null,
            h("h1", { class: "question-text" }, text)),
        h("div", { class: "stack-tight" }, holder, hint),
        stickyActions(continueButton));
}

function testsIntro(advance)
{
    const tests =
    [
        ["hand", "test.tapping.name", "test.tapping.meta", 1],
        ["tremor", "test.tremor.name", "test.tremor.meta", 1],
        ["face", "test.face.name", "test.face.meta", 1],
        ["mic", "test.voice.name", "test.voice.meta", 2],
        ["spiral", "test.spiral.name", "test.spiral.meta", 1]
    ];
    const tips = [["phone", "tests.setup.prop"], ["hand", "tests.setup.distance"], ["light", "tests.setup.light"], ["quiet", "tests.setup.quiet"]];
    speak(t("tests.title") + ". " + t("tests.lede"));
    return h("div", { class: "stack-loose" },
        h("div", { class: "stack" }, h("h1", null, t("tests.title")), h("p", { class: "lede" }, t("tests.lede"))),
        h("ul", { class: "test-list" }, tests.map(([iconName, nameKey, metaKey, minutes]) =>
            h("li", null,
                h("span", { class: "icon-cell" }, icon(iconName)),
                h("div", null, h("strong", null, t(nameKey)), h("span", { class: "meta" }, t(metaKey))),
                h("span", { class: "time" }, t("tests.minutes", { n: minutes }))))),
        h("section", { class: "stack" },
            h("h2", null, t("tests.setup.title")),
            h("ul", { class: "setup-tips" }, tips.map(([iconName, key]) => h("li", null, icon(iconName), h("span", null, t(key)))))),
        stickyActions(button(t("tests.start"), () =>
        {
            unlockAudio();
            advance();
        })));
}

export function screenView(context)
{
    const hash = window.location.hash;
    if (hash.includes("new=1"))
    {
        startScreening();
        history.replaceState(null, "", "#/screen");
    }
    else if (!getState().screening || getState().screening.completedAt)
    {
        startScreening();
    }
    const steps = allSteps();
    const screening = getState().screening;
    let index = Math.max(0, steps.indexOf(screening.step || "about"));
    const step = steps[index];
    const advance = () =>
    {
        if (index >= steps.length - 1)
        {
            finishScreening();
            closeCamera();
            closeMicrophone();
            context.navigate("results");
            return;
        }
        setStep(steps[index + 1]);
        context.rerender();
    };
    const back = () =>
    {
        if (index === 0)
        {
            context.navigate("");
            return;
        }
        setStep(steps[index - 1]);
        context.rerender();
    };
    const saveResult = (key, value) =>
    {
        update((draft) =>
        {
            draft.screening.results[key] = value;
        });
    };
    const testNumber = TEST_STEPS.indexOf(step);
    const progress = testNumber >= 0 ? { label: t("screen.progress.test", { n: testNumber + 1, total: TEST_STEPS.length }), fraction: (testNumber + 1) / TEST_STEPS.length } : null;
    const dominant = getState().settings.dominant || "right";
    const other = dominant === "right" ? "left" : "right";
    const isLast = index === steps.length - 1;
    const common = { progress, onCleanup: context.onCleanup, nextLabel: isLast ? t("step.results") : null };
    if (step === "about")
    {
        return aboutStep(context, advance);
    }
    if (step.startsWith("q"))
    {
        return questionStep(Number(step.slice(1)), advance, back);
    }
    if (step === "tests")
    {
        return testsIntro(advance);
    }
    if (step === "tap-right" || step === "tap-left")
    {
        const side = step === "tap-right" ? "right" : "left";
        const key = side === "right" ? "tapRight" : "tapLeft";
        const options =
        {
            ...common,
            side,
            onDone: (result) =>
            {
                saveResult(key, result);
                advance();
            },
            onSkip: () =>
            {
                saveResult(key, null);
                advance();
            }
        };
        return tappingStep(options);
    }
    if (step === "tremor")
    {
        const options =
        {
            ...common,
            onDone: (results) =>
            {
                saveResult("tremorRest", results.rest || null);
                saveResult("tremorPosture", results.posture || null);
                advance();
            },
            onSkip: () =>
            {
                saveResult("tremorRest", null);
                saveResult("tremorPosture", null);
                advance();
            }
        };
        return tremorStep(options);
    }
    if (step === "face")
    {
        const options =
        {
            ...common,
            onDone: (result) =>
            {
                saveResult("face", result);
                closeCamera();
                advance();
            },
            onSkip: () =>
            {
                saveResult("face", null);
                closeCamera();
                advance();
            }
        };
        return faceStep(options);
    }
    if (step === "voice")
    {
        const options =
        {
            ...common,
            onDone: (result) =>
            {
                saveResult("voice", result);
                closeMicrophone();
                advance();
            },
            onSkip: () =>
            {
                saveResult("voice", null);
                closeMicrophone();
                advance();
            }
        };
        return voiceStep(options);
    }
    const side = step === "spiral-first" ? dominant : other;
    const key = side === "right" ? "spiralRight" : "spiralLeft";
    const options =
    {
        ...common,
        side,
        onDone: (result, drawing) =>
        {
            saveResult(key, result);
            saveResult(key + "Drawing", drawing);
            advance();
        },
        onSkip: () =>
        {
            saveResult(key, null);
            advance();
        }
    };
    return spiralStep(options);
}
