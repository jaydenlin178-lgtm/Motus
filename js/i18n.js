import { STRINGS } from "./strings.js";
import { getState } from "./store.js";

export function currentLang()
{
    const chosen = getState().settings.lang;
    if (chosen === "en" || chosen === "es")
    {
        return chosen;
    }
    const browser = (navigator.language || "en").toLowerCase();
    return browser.startsWith("es") ? "es" : "en";
}

export function t(key, params)
{
    const entry = STRINGS[key];
    const lang = currentLang();
    let text = entry ? (entry[lang] || entry.en) : key;
    if (params)
    {
        for (const [name, value] of Object.entries(params))
        {
            text = text.split("{" + name + "}").join(String(value));
        }
    }
    return text;
}

export function sideWord(side)
{
    return t(side === "left" ? "side.left" : "side.right");
}

export function formatDate(timestamp, withTime)
{
    const lang = currentLang();
    const locale = lang === "es" ? "es-US" : "en-US";
    const options = withTime ? { month: "short", day: "numeric", hour: "numeric" } : { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat(locale, options).format(new Date(timestamp));
}

export function formatHour(timestamp)
{
    const lang = currentLang();
    const locale = lang === "es" ? "es-US" : "en-US";
    return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(timestamp));
}

export function dayLabel(timestamp)
{
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())
    {
        return t("track.today");
    }
    if (date.toDateString() === yesterday.toDateString())
    {
        return t("track.yesterday");
    }
    const locale = currentLang() === "es" ? "es-US" : "en-US";
    return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(date);
}
