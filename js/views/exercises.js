import { h, clear, formatNumber } from "../ui.js";
import { icon } from "../icons.js";
import { t, currentLang, dayLabel, formatHour } from "../i18n.js";
import { exerciseSessions, saveExerciseSession } from "../store.js";
import { EXERCISES, EXERCISE_GROUPS } from "../exercises/index.js";
import { readout, panel } from "./result-blocks.js";
import { barChart } from "../charts.js";
import { stickyActions, button, errorBox } from "./steps/common.js";
import { stopSpeaking, speak } from "../speech.js";
import { setBusy } from "../busy.js";

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function unitFor(exercise)
{
    return t("ex." + exercise.id + ".unit");
}

function scoreText(exercise, score)
{
    const unit = unitFor(exercise);
    return fmt(score, exercise.digits) + (unit === "%" ? "%" : " " + unit);
}

function whenText(timestamp)
{
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())
    {
        return t("ex.when.today");
    }
    if (date.toDateString() === yesterday.toDateString())
    {
        return t("ex.when.yesterday");
    }
    return t("ex.when.on", { date: dayLabel(timestamp) });
}

function lastSummary(exercise)
{
    const sessions = exerciseSessions(exercise.id);
    if (!sessions.length)
    {
        return h("span", { class: "ex-last is-new" }, t("ex.new"));
    }
    const last = sessions[sessions.length - 1];
    return h("span", { class: "ex-last" }, icon("check"), h("span", null, t("ex.lastLine", { value: scoreText(exercise, last.score), when: whenText(last.at) })));
}

export function exercisesView()
{
    const groups = EXERCISE_GROUPS.map((group) =>
        h("section", { class: "ex-group" },
            h("h2", null, t(group.titleKey)),
            h("ul", { class: "ex-list" }, group.ids.map((id) =>
            {
                const exercise = EXERCISES.find((item) => item.id === id);
                return h("li", null, h("a", { class: "ex-row", href: "#/exercise/" + id },
                    h("span", { class: "path-icon" }, icon(exercise.icon)),
                    h("span", { class: "ex-text" }, h("strong", null, t("ex." + id + ".title")), h("span", null, t("ex." + id + ".purpose")), lastSummary(exercise)),
                    icon("next", "path-chevron")));
            }))));
    return h("div", { class: "exercises" },
        h("div", { class: "stack" },
            h("h1", null, t("ex.hub.title")),
            h("p", { class: "lede" }, t("ex.hub.lede"))),
        groups,
        h("p", { class: "result-note section" }, t("ex.hub.note")));
}

function historyChart(exercise, sessions)
{
    const recent = sessions.slice(-12);
    return panel(t("ex.history"), unitFor(exercise), barChart(
    {
        values: recent.map((session) => session.score),
        height: 130,
        xLabel: t("ex.sessionAxis"),
        yFormat: (y) => fmt(y, 0),
        tooltip: (i, value) => [fmt(value, exercise.digits) + " " + unitFor(exercise), dayLabel(recent[i].at) + ", " + formatHour(recent[i].at)]
    }));
}

function introPanel(exercise, sessions)
{
    const items = [];
    items.push(h("p", { class: "lede" }, t("ex." + exercise.id + ".how")));
    items.push(h("div", { class: "why-note" }, icon("book"), h("div", null, h("strong", null, t("ex.why")), h("p", null, t("ex." + exercise.id + ".why")))));
    if (exercise.safety)
    {
        items.push(h("div", { class: "safety-note", role: "note" }, icon("alert"), h("p", null, t("ex." + exercise.id + ".safety"))));
    }
    if (sessions.length)
    {
        const last = sessions[sessions.length - 1];
        const best = Math.max(...sessions.map((s) => s.score));
        items.push(h("div", { class: "readouts readouts-3" },
            readout(t("ex.lastTime"), fmt(last.score, exercise.digits), unitFor(exercise), false),
            readout(t("ex.best"), fmt(best, exercise.digits), unitFor(exercise), false),
            readout(t("ex.sessions"), String(sessions.length), null, false)));
    }
    if (sessions.length >= 2)
    {
        items.push(historyChart(exercise, sessions));
    }
    return items;
}

export function exercisePage(exercise, context)
{
    const root = h("div", { class: "step step-capture exercise-page" });
    const body = h("div", { class: "stack" });
    const back = h("a", { class: "back-link", href: "#/exercises" }, icon("back"), t("ex.backToList"));
    root.appendChild(back);
    root.appendChild(h("h1", null, t("ex." + exercise.id + ".title")));
    root.appendChild(body);
    let cleanups = [];
    const runCleanups = () =>
    {
        for (const fn of cleanups)
        {
            try
            {
                fn();
            }
            catch (error)
            {
                continue;
            }
        }
        cleanups = [];
    };
    context.onCleanup(() =>
    {
        runCleanups();
        setBusy(false);
        stopSpeaking();
    });

    function showIntro()
    {
        runCleanups();
        clear(body);
        back.hidden = false;
        const sessions = exerciseSessions(exercise.id);
        for (const item of introPanel(exercise, sessions))
        {
            body.appendChild(item);
        }
        body.appendChild(stickyActions(button(t("ex.start"), () => startSession())));
        speak(t("ex." + exercise.id + ".how"));
    }

    function startSession()
    {
        stopSpeaking();
        clear(body);
        back.hidden = true;
        const api =
        {
            body,
            sessions: exerciseSessions(exercise.id),
            onCleanup(fn)
            {
                cleanups.push(fn);
            },
            finish(result)
            {
                runCleanups();
                setBusy(false);
                showSummary(result);
            },
            fail(message, detail)
            {
                runCleanups();
                setBusy(false);
                clear(body);
                back.hidden = false;
                body.appendChild(errorBox(message, detail || null));
                body.appendChild(stickyActions(button(t("common.retry"), () => startSession()), button(t("ex.backToList"), () => context.navigate("exercises"), "quiet")));
            },
            cancel()
            {
                showIntro();
            }
        };
        exercise.run(api);
    }

    function showSummary(result)
    {
        const previous = exerciseSessions(exercise.id).slice();
        const session = { at: Date.now(), score: result.score, details: result.details || {} };
        saveExerciseSession(exercise.id, session);
        const all = previous.concat([session]);
        clear(body);
        back.hidden = false;
        body.appendChild(h("div", { class: "saved-line" }, icon("check"), h("span", null, t("ex.saved"))));
        body.appendChild(h("div", { class: "readouts" }, result.highlights.map(([label, value, unit, flagged]) => readout(label, value, unit, flagged))));
        if (previous.length)
        {
            const change = result.score - previous[previous.length - 1].score;
            const key = Math.abs(change) < Math.pow(10, -exercise.digits) ? "ex.same" : change > 0 ? "ex.up" : "ex.down";
            body.appendChild(h("p", { class: "compare-line" }, t(key, { n: fmt(Math.abs(change), exercise.digits), unit: t("ex." + exercise.id + ".changeUnit") })));
        }
        if (result.note)
        {
            body.appendChild(h("p", { class: "result-note" }, result.note));
        }
        if (all.length >= 2)
        {
            body.appendChild(historyChart(exercise, all));
        }
        body.appendChild(stickyActions(button(t("ex.done"), () => context.navigate("exercises")), button(t("ex.again"), () => startSession(), "quiet")));
        speak(t("ex.saved"));
    }

    showIntro();
    return root;
}
