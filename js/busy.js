let busy = false;
let lock = null;
const listeners = new Set();

function holdScreen(on)
{
    if (!navigator.wakeLock)
    {
        return;
    }
    if (on && !lock)
    {
        navigator.wakeLock.request("screen").then((sentinel) =>
        {
            if (busy && !lock)
            {
                lock = sentinel;
            }
            else
            {
                sentinel.release().catch(() => null);
            }
        }).catch(() => null);
    }
    else if (!on && lock)
    {
        lock.release().catch(() => null);
        lock = null;
    }
}

export function isBusy()
{
    return busy;
}

export function setBusy(value)
{
    if (busy === value)
    {
        return;
    }
    busy = value;
    holdScreen(busy);
    for (const listener of listeners)
    {
        listener(busy);
    }
}

export function onBusyChange(listener)
{
    listeners.add(listener);
}
