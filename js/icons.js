import { s } from "./ui.js";

const PATHS =
{
    back: ["M15 5l-7 7 7 7"],
    next: ["M9 5l7 7-7 7"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    speaker: ["M4 9.5h3.5L12 5.5v13l-4.5-4H4z", "M15.5 9a4 4 0 010 6", "M18 6.5a7.5 7.5 0 010 11"],
    speakerOff: ["M4 9.5h3.5L12 5.5v13l-4.5-4H4z", "M16 9.5l5 5", "M21 9.5l-5 5"],
    hand: ["M8 13V6.5a1.5 1.5 0 013 0V12", "M11 11V4.5a1.5 1.5 0 013 0V11", "M14 11V6a1.5 1.5 0 013 0v7.5c0 4-2.5 6.5-6 6.5-2.6 0-4.2-1.3-5.4-3.4L4 13.6a1.5 1.5 0 012.5-1.6L8 14"],
    tremor: ["M9 13V6.5a1.5 1.5 0 013 0V12", "M12 11V5a1.5 1.5 0 013 0v8.5c0 3.6-2.2 6-5.3 6-2.3 0-3.7-1.2-4.8-3l-1.6-3a1.4 1.4 0 012.4-1.4L9 14", "M18.5 7c1 1 1 3 0 4", "M20.5 5c2 2 2 6 0 8"],
    face: ["M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z", "M9 10h.01", "M15 10h.01", "M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"],
    mic: ["M12 3.5a3 3 0 013 3v5a3 3 0 01-6 0v-5a3 3 0 013-3z", "M6 11.5a6 6 0 0012 0", "M12 17.5v3"],
    spiral: ["M12 12c.6 0 1 .4 1 1s-.6 1.6-1.6 1.6S9.5 13.6 9.5 12.5 10.6 10 12.2 10s3.4 1.3 3.4 3.3-1.8 3.9-4 3.9-4.3-1.8-4.3-4.4 2.3-5.3 5-5.3 5.6 2.2 5.6 5.4"],
    shield: ["M12 3.5l7 2.6v5.3c0 4.3-2.9 7.6-7 9.1-4.1-1.5-7-4.8-7-9.1V6.1z", "M9 12l2.2 2.2L15.5 10"],
    info: ["M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z", "M12 11v5", "M12 7.8h.01"],
    flag: ["M6 20.5V4.5", "M6 5h10.5l-2 4 2 4H6"],
    print: ["M7 9V4h10v5", "M7 17H5a1.5 1.5 0 01-1.5-1.5v-5A1.5 1.5 0 015 9h14a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0119 17h-2", "M7 14h10v6H7z"],
    plus: ["M12 5v14", "M5 12h14"],
    pill: ["M10.5 20.5a5 5 0 01-7-7l6-6a5 5 0 017 7z", "M7.5 10.5l6 6"],
    chart: ["M4 19.5h16", "M6.5 16l4-5 3 3 4.5-6.5"],
    clock: ["M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z", "M12 7.5V12l3 2"],
    light: ["M12 3v2", "M12 19v2", "M5.6 5.6l1.4 1.4", "M17 17l1.4 1.4", "M3 12h2", "M19 12h2", "M5.6 18.4L7 17", "M17 7l1.4-1.4", "M12 8a4 4 0 100 8 4 4 0 000-8z"],
    phone: ["M8 3.5h8a1.5 1.5 0 011.5 1.5v14a1.5 1.5 0 01-1.5 1.5H8A1.5 1.5 0 016.5 19V5A1.5 1.5 0 018 3.5z", "M11 17.5h2"],
    quiet: ["M4 9.5h3.5L12 5.5v13l-4.5-4H4z", "M16 12h5"],
    camera: ["M4 8.5A1.5 1.5 0 015.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z", "M12 10a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z"],
    alert: ["M12 4l8.5 15h-17z", "M12 10v4", "M12 16.8h.01"],
    trend: ["M4 16l5-5 3.5 3.5L20 7", "M15 7h5v5"],
    lowered: ["M12 5v14", "M6.5 13.5L12 19l5.5-5.5"],
    raised: ["M12 19V5", "M6.5 10.5L12 5l5.5 5.5"],
    minus: ["M6 12h12"],
    book: ["M5 4.5h5.5A2.5 2.5 0 0113 7v12.5a2 2 0 00-2-2H5z", "M19 4.5h-5.5A2.5 2.5 0 0011 7v12.5a2 2 0 012-2h6z"],
    trash: ["M5 7h14", "M9.5 7V4.5h5V7", "M7 7l1 12.5h8L17 7"],
    home: ["M4 11.5l8-7 8 7", "M6.5 9.5v10h11v-10", "M10 19.5v-5h4v5"],
    clipboard: ["M9 4h6v3H9z", "M7.5 5.5H5.5v15h13v-15h-2", "M9 13.5l2 2 4-4.5"],
    walk: ["M13.5 3.5a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z", "M11 21l2-6-2.5-2.5 1-4.5", "M11.5 8l3 2.5 3 1", "M11.5 8l-3 2-1 3", "M13 15l2.5 2.5V21"],
    reach: ["M12 3.5a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z", "M3.5 9l8.5 1.5L20.5 9", "M12 10.5v5", "M12 15.5l-3 5", "M12 15.5l3 5"],
    target: ["M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z", "M12 8a4 4 0 100 8 4 4 0 000-8z", "M12 11.5v1"],
    pen: ["M15.5 4.5l4 4L9 19H5v-4z", "M13.5 6.5l4 4", "M4 21h16"],
    loud: ["M12 3.5a3 3 0 013 3v5a3 3 0 01-6 0v-5a3 3 0 013-3z", "M6 11.5a6 6 0 0012 0", "M12 17.5v3", "M19.5 5c1.2 1.5 1.2 4.5 0 6", "M4.5 5c-1.2 1.5-1.2 4.5 0 6"]
};

export function icon(name, extraClass)
{
    const svg = s("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.9", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: extraClass || null });
    for (const d of PATHS[name] || [])
    {
        svg.appendChild(s("path", { d }));
    }
    return svg;
}

export function logoMark()
{
    const svg = s("svg", { viewBox: "0 0 32 32", "aria-hidden": "true", focusable: "false" });
    svg.appendChild(s("rect", { x: "1", y: "1", width: "30", height: "30", rx: "9", fill: "#18213a" }));
    svg.appendChild(s("path", { d: spiralPath(16, 16, 3.05, 2.6, 0.2), fill: "none", stroke: "#ffffff", "stroke-width": "2.3", "stroke-linecap": "round" }));
    return svg;
}

export function spiralPath(cx, cy, spacing, turns, startRadius = 0)
{
    const steps = Math.max(40, Math.round(turns * 72));
    let d = "";
    for (let i = 0; i <= steps; i++)
    {
        const angle = i / steps * turns * 2 * Math.PI;
        const radius = startRadius + spacing * angle / (2 * Math.PI);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
    }
    return d;
}
