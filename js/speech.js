import { getState } from "./store.js";

let cachedVoices = [];

function refreshVoices()
{
    if ("speechSynthesis" in window)
    {
        cachedVoices = window.speechSynthesis.getVoices();
    }
}

if ("speechSynthesis" in window)
{
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

function pickVoice(lang)
{
    const preferences = lang === "es" ? ["es-US", "es-MX", "es-419", "es-ES", "es"] : ["en-US", "en-GB", "en"];
    for (const code of preferences)
    {
        const match = cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith(code.toLowerCase()));
        if (match)
        {
            return match;
        }
    }
    return null;
}

export function speechAvailable()
{
    return "speechSynthesis" in window;
}

export function unlockSpeech()
{
    if (!speechAvailable())
    {
        return;
    }
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
}

export function stopSpeaking()
{
    if (speechAvailable())
    {
        window.speechSynthesis.cancel();
    }
}

export function speak(text, options = {})
{
    const settings = getState().settings;
    if (!speechAvailable() || (!settings.voice && !options.force) || !text)
    {
        return Promise.resolve();
    }
    stopSpeaking();
    return new Promise((resolve) =>
    {
        const utterance = new SpeechSynthesisUtterance(text);
        const lang = settings.lang || "en";
        utterance.lang = lang === "es" ? "es-US" : "en-US";
        const voice = pickVoice(lang);
        if (voice)
        {
            utterance.voice = voice;
        }
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
        window.setTimeout(resolve, Math.min(20000, 1500 + text.length * 90));
    });
}
