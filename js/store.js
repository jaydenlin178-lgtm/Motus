const KEY = "motus.v1";

function emptyState()
{
    const state =
    {
        settings: { lang: null, voice: true, dominant: "right" },
        screening: null,
        screenings: [],
        track: { checks: [], doses: [], example: false },
        exercises: {}
    };
    return state;
}

let state = load();
const listeners = new Set();

function load()
{
    try
    {
        const raw = window.localStorage.getItem(KEY);
        if (!raw)
        {
            return emptyState();
        }
        const parsed = JSON.parse(raw);
        const base = emptyState();
        const loaded =
        {
            settings: { ...base.settings, ...(parsed.settings || {}) },
            screening: parsed.screening || null,
            screenings: Array.isArray(parsed.screenings) ? parsed.screenings : [],
            track: { ...base.track, ...(parsed.track || {}) },
            exercises: parsed.exercises && typeof parsed.exercises === "object" ? parsed.exercises : {}
        };
        return loaded;
    }
    catch (error)
    {
        return emptyState();
    }
}

export function persist()
{
    try
    {
        window.localStorage.setItem(KEY, JSON.stringify(state));
    }
    catch (error)
    {
        return false;
    }
    return true;
}

export function getState()
{
    return state;
}

export function update(mutator)
{
    mutator(state);
    persist();
    for (const listener of listeners)
    {
        listener(state);
    }
}

export function subscribe(listener)
{
    listeners.add(listener);
    return () =>
    {
        listeners.delete(listener);
    };
}

export function newId()
{
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function startScreening()
{
    update((draft) =>
    {
        draft.screening =
        {
            id: newId(),
            startedAt: Date.now(),
            age: null,
            sex: null,
            answers: {},
            results: {},
            completedAt: null
        };
    });
    return state.screening;
}

export function finishScreening()
{
    update((draft) =>
    {
        if (!draft.screening)
        {
            return;
        }
        draft.screening.completedAt = Date.now();
        draft.screenings = [draft.screening, ...draft.screenings.filter((s) => s.id !== draft.screening.id)].slice(0, 5);
    });
}

export function latestScreening()
{
    if (state.screening && state.screening.completedAt)
    {
        return state.screening;
    }
    return state.screenings[0] || null;
}

export function exerciseSessions(id)
{
    return (state.exercises && state.exercises[id]) || [];
}

export function saveExerciseSession(id, session)
{
    update((draft) =>
    {
        if (!draft.exercises)
        {
            draft.exercises = {};
        }
        const list = draft.exercises[id] || [];
        list.push(session);
        draft.exercises[id] = list.slice(-60);
    });
}

export function eraseEverything()
{
    try
    {
        window.localStorage.removeItem(KEY);
    }
    catch (error)
    {
        state = emptyState();
    }
    const lang = state.settings.lang;
    state = emptyState();
    state.settings.lang = lang;
    persist();
    for (const listener of listeners)
    {
        listener(state);
    }
}
