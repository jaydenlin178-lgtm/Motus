const SVG_NS = "http://www.w3.org/2000/svg";

function applyProps(element, props, isSvg)
{
    if (!props)
    {
        return;
    }
    for (const [key, value] of Object.entries(props))
    {
        if (value === null || value === undefined || value === false)
        {
            continue;
        }
        if (key === "class")
        {
            element.setAttribute("class", value);
        }
        else if (key === "style" && typeof value === "object")
        {
            Object.assign(element.style, value);
        }
        else if (key.startsWith("on") && typeof value === "function")
        {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (key === "html")
        {
            element.innerHTML = value;
        }
        else if (key === "ref" && typeof value === "function")
        {
            value(element);
        }
        else if (!isSvg && (key === "value" || key === "checked" || key === "disabled"))
        {
            element[key] = value;
        }
        else
        {
            element.setAttribute(key, value === true ? "" : String(value));
        }
    }
}

function appendChildren(element, children)
{
    for (const child of children.flat(Infinity))
    {
        if (child === null || child === undefined || child === false)
        {
            continue;
        }
        if (child instanceof Node)
        {
            element.appendChild(child);
        }
        else
        {
            element.appendChild(document.createTextNode(String(child)));
        }
    }
}

export function h(tag, props, ...children)
{
    const element = document.createElement(tag);
    applyProps(element, props, false);
    appendChildren(element, children);
    return element;
}

export function s(tag, props, ...children)
{
    const element = document.createElementNS(SVG_NS, tag);
    applyProps(element, props, true);
    appendChildren(element, children);
    return element;
}

export function clear(element)
{
    while (element.firstChild)
    {
        element.removeChild(element.firstChild);
    }
}

export function fragment(...children)
{
    const frag = document.createDocumentFragment();
    appendChildren(frag, children);
    return frag;
}

export function toast(message, duration = 2600)
{
    const existing = document.querySelector(".toast");
    if (existing)
    {
        existing.remove();
    }
    const element = h("div", { class: "toast", role: "status" }, message);
    document.body.appendChild(element);
    window.setTimeout(() =>
    {
        element.remove();
    }, duration);
}

export function sleep(ms)
{
    return new Promise((resolve) =>
    {
        window.setTimeout(resolve, ms);
    });
}

export function formatNumber(value, digits, lang)
{
    if (value === null || value === undefined || !isFinite(value))
    {
        return lang === "es" ? "N/D" : "n/a";
    }
    const locale = lang === "es" ? "es-US" : "en-US";
    const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const shown = Math.round(Math.abs(value) * Math.pow(10, digits)) === 0 ? 0 : value;
    return formatter.format(shown);
}

export function sizeCanvas(canvas)
{
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height)
    {
        canvas.width = width;
        canvas.height = height;
    }
    const size = { width, height, ratio, cssWidth: rect.width, cssHeight: rect.height };
    return size;
}
