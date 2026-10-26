import { h, clear } from "./ui.js";
import { icon, logoMark } from "./icons.js";
import { t, currentLang } from "./i18n.js";
import { getState, update, subscribe, latestScreening } from "./store.js";
import { stopSpeaking, speechAvailable, unlockSpeech } from "./speech.js";
import { unlockAudio } from "./sound.js";
import { defineRoute, startRouter, render, navigate } from "./router.js";
import { isSimulated } from "./env.js";
import { isBusy, onBusyChange } from "./busy.js";
import { homeView } from "./views/home.js";
import { learnView } from "./views/learn.js";
import { screenView } from "./views/screen.js";
import { resultsView } from "./views/results.js";
import { trackView } from "./views/track.js";
import { trackCheckView } from "./views/track-check.js";
import { screenReportView, trackReportView } from "./views/report.js";
import { exercisesView, exercisePage } from "./views/exercises.js";
import { EXERCISES } from "./exercises/index.js";

const masthead = document.getElementById("masthead");
const tabbar = document.getElementById("tabbar");
const splash = document.getElementById("splash");
const TAB_ROUTES = ["", "results", "track", "exercises", "learn"];
const colophon = document.getElementById("colophon");
const main = document.getElementById("main");

function renderMasthead()
{
    clear(masthead);
    const settings = getState().settings;
    const busy = isBusy();
    const langButton = h("button",
    {
        class: "chip-button",
        type: "button",
        lang: currentLang() === "en" ? "es" : "en",
        "aria-label": t("lang.switchLabel"),
        disabled: busy,
        onClick: () =>
        {
            stopSpeaking();
            update((draft) =>
            {
                draft.settings.lang = currentLang() === "en" ? "es" : "en";
            });
            render();
        }
    }, t("lang.switch"));
    const voiceButton = speechAvailable() ? h("button",
    {
        class: "chip-button",
        type: "button",
        "aria-pressed": settings.voice ? "true" : "false",
        "aria-label": t("voice.label"),
        onClick: () =>
        {
            const next = !getState().settings.voice;
            if (!next)
            {
                stopSpeaking();
            }
            update((draft) =>
            {
                draft.settings.voice = next;
            });
        }
    }, icon(settings.voice ? "speaker" : "speakerOff"), h("span", null, settings.voice ? t("voice.on") : t("voice.off"))) : null;
    const home = h("a", { class: "wordmark", href: "#/", "aria-label": t("nav.home") }, logoMark(), h("span", null, t("app.name")));
    masthead.appendChild(home);
    masthead.appendChild(h("div", { class: "masthead-controls" }, voiceButton, langButton));
}

function renderColophon()
{
    clear(colophon);
    colophon.appendChild(h("a", { href: "#/learn" }, t("nav.learn")));
    colophon.appendChild(h("span", null, t("footer.made")));
    if (isSimulated())
    {
        colophon.appendChild(h("span", { class: "flag-tag" }, t("sim.banner")));
    }
}

function activeTab(path)
{
    if (path === "")
    {
        return "home";
    }
    if (path === "results" || path === "screen")
    {
        return "screen";
    }
    if (path.startsWith("track"))
    {
        return "track";
    }
    if (path === "exercises" || path.startsWith("exercise/"))
    {
        return "exercises";
    }
    return null;
}

function renderTabbar(path)
{
    const visible = TAB_ROUTES.includes(path);
    tabbar.hidden = !visible;
    document.body.classList.toggle("has-tabbar", visible);
    clear(tabbar);
    if (!visible)
    {
        return;
    }
    tabbar.setAttribute("aria-label", t("tab.label"));
    const current = activeTab(path);
    const tabs =
    [
        ["home", "#/", "home", "tab.home"],
        ["screen", latestScreening() ? "#/results" : "#/screen", "clipboard", "tab.screen"],
        ["track", "#/track", "chart", "tab.track"],
        ["exercises", "#/exercises", "walk", "tab.exercises"]
    ];
    for (const [id, href, iconName, labelKey] of tabs)
    {
        const active = id === current;
        tabbar.appendChild(h("a", { class: "tab" + (active ? " is-active" : ""), href, "aria-current": active ? "page" : null }, icon(iconName), h("span", null, t(labelKey))));
    }
}

function dismissSplash()
{
    if (!splash)
    {
        return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = Math.max(0, (reduce ? 300 : 1300) - performance.now());
    window.setTimeout(() =>
    {
        splash.classList.add("is-done");
        window.dispatchEvent(new Event("motus:splash-done"));
        window.setTimeout(() =>
        {
            splash.remove();
        }, 500);
    }, wait);
}

function syncDocument(path)
{
    document.documentElement.lang = currentLang();
    document.title = t("app.title");
    document.body.dataset.route = path || "home";
}

defineRoute("", homeView);
defineRoute("learn", learnView);
defineRoute("screen", screenView);
defineRoute("results", resultsView);
defineRoute("track", trackView);
defineRoute("track/check", trackCheckView);
defineRoute("report/screen", screenReportView);
defineRoute("report/track", trackReportView);
defineRoute("exercises", exercisesView);
for (const exercise of EXERCISES)
{
    defineRoute("exercise/" + exercise.id, (context) => exercisePage(exercise, context));
}

subscribe(() =>
{
    renderMasthead();
});

onBusyChange(() =>
{
    renderMasthead();
});

window.addEventListener("pointerdown", () =>
{
    unlockAudio();
    unlockSpeech();
}, { once: true, capture: true });

startRouter(main, (path) =>
{
    syncDocument(path);
    renderMasthead();
    renderColophon();
    renderTabbar(path);
});

dismissSplash();

window.motus = { navigate };
