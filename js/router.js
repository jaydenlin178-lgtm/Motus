import { clear } from "./ui.js";

const routes = new Map();
let cleanups = [];
let mainElement = null;
let afterRender = null;

export function defineRoute(path, view)
{
    routes.set(path, view);
}

export function currentPath()
{
    const raw = window.location.hash.replace(/^#\/?/, "");
    return raw.split("?")[0];
}

export function navigate(path)
{
    const target = "#/" + path;
    if (window.location.hash === target)
    {
        render();
    }
    else
    {
        window.location.hash = target;
    }
}

export function runCleanups()
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
}

export function render()
{
    runCleanups();
    const path = currentPath();
    const view = routes.get(path) || routes.get("");
    clear(mainElement);
    const context =
    {
        path,
        navigate,
        onCleanup(fn)
        {
            cleanups.push(fn);
        },
        rerender: render
    };
    const element = view(context);
    if (element)
    {
        mainElement.appendChild(element);
    }
    window.scrollTo(0, 0);
    mainElement.focus({ preventScroll: true });
    if (afterRender)
    {
        afterRender(path);
    }
}

export function startRouter(main, onRendered)
{
    mainElement = main;
    afterRender = onRendered;
    window.addEventListener("hashchange", render);
    render();
}
