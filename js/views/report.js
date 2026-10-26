import { h, formatNumber } from "../ui.js";
import { icon } from "../icons.js";
import { t, currentLang, formatDate, sideWord } from "../i18n.js";
import { getState, latestScreening } from "../store.js";
import { computeScreening, QUESTIONS } from "../screening.js";
import { readout, panel } from "./result-blocks.js";
import { scatterChart, barChart } from "../charts.js";
import { checkSpeed, checkTremor, hoursSinceDose, doseCurve, doseDomain, TIME } from "../track-data.js";
import { mean } from "../dsp.js";

const NA = () => t("common.na");

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function signed(value, digits)
{
    if (!isFinite(value))
    {
        return NA();
    }
    const text = fmt(Math.abs(value), digits);
    if (Number(text.replace(/[^0-9.]/g, "")) === 0)
    {
        return text;
    }
    return (value < 0 ? "−" : "+") + text;
}

function toolbar()
{
    const back = () =>
    {
        if (history.length > 1)
        {
            history.back();
        }
        else
        {
            window.location.hash = "#/";
        }
    };
    return h("div", { class: "report-toolbar no-print" },
        h("button", { class: "back-link", type: "button", onClick: back }, icon("back"), t("nav.back")),
        h("button", { class: "button button-compact", type: "button", onClick: () => window.print() }, icon("print"), t("report.print")));
}

function head(subtitleKey, metaLines)
{
    return h("header", { class: "report-head" },
        h("h1", null, t("report.title")),
        h("p", { class: "report-subtitle" }, t(subtitleKey)),
        h("p", { class: "report-meta" }, metaLines.join("  ·  ")));
}

function table(headers, rows, options = {})
{
    return h("table", { class: "report-table" + (options.compact ? " is-compact" : "") },
        h("thead", null, h("tr", null, headers.map((label, i) => h("th", { scope: "col", class: i > 0 ? "num" : null }, label)))),
        h("tbody", null, rows.map((row) => h("tr", { class: row.className || null }, (row.cells || row).map((cell, i) => (i === 0 ? h("th", { scope: "row" }, cell) : h("td", { class: "num" }, cell)))))));
}

function sideValue(result, read, digits, format)
{
    if (!result || !result.ok)
    {
        return NA();
    }
    const value = read(result);
    if (!isFinite(value))
    {
        return NA();
    }
    return format ? format(value, digits) : fmt(value, digits);
}

function tremorCell(hand)
{
    if (!hand || !hand.ok)
    {
        return NA();
    }
    if (!hand.detected)
    {
        return t("m.none");
    }
    return [fmt(hand.frequency, 1) + " Hz", h("br"), fmt(hand.amplitudeMm, 1) + " mm"];
}

function spiralTremorCell(spiral)
{
    if (!spiral || !spiral.ok)
    {
        return NA();
    }
    return spiral.tremor.detected ? fmt(spiral.tremor.frequency, 1) + " Hz" : t("m.none");
}

function answerLabel(question, answer)
{
    if (answer === "yes" || answer === "no" || answer === "unsure")
    {
        return t("common." + answer);
    }
    if (answer)
    {
        return t("q." + question.key + "." + answer);
    }
    return NA();
}

export function screenReportView()
{
    const screening = latestScreening();
    if (!screening)
    {
        return h("p", null, t("report.none"));
    }
    const summary = computeScreening(screening);
    const r = screening.results || {};
    const sexLabel = screening.sex === "male" ? t("screen.about.male") : screening.sex === "female" ? t("screen.about.female") : t("screen.about.preferNot");
    const tierTitle = summary.mode === "risk" ? t("tier." + summary.tier + ".title") : t(summary.tier >= 2 ? "tier.motor2.title" : "tier.motor1.title");
    const motor = summary.motor;
    const estimate = summary.mode === "risk"
        ? h("div", { class: "readouts readouts-3" },
            readout(t("report.estimate"), fmt(summary.posteriorPct, summary.posteriorPct < 10 ? 1 : 0), "%", summary.tier >= 2),
            readout(t("report.prior"), fmt(summary.priorPct, 2), "%", false),
            readout(t("report.motorTests"), String(motor.abnormal), t("report.ofN", { n: motor.completed }), motor.positive))
        : h("p", { class: "quiet" }, t("tier.young"));
    const factorRows = summary.factors.map((factor) => [t(factor.labelKey, factor.labelParams), "×" + fmt(factor.lr, 2)]);
    if (summary.mode === "risk" && summary.factors.length)
    {
        const combined = summary.factors.reduce((product, factor) => product * factor.lr, 1);
        factorRows.push({ className: "is-total", cells: [t("report.combined"), "×" + fmt(combined, combined >= 10 ? 1 : 2)] });
        factorRows.push({ className: "is-subtotal", cells: [t("report.prodromal"), "×" + fmt(summary.prodromal, summary.prodromal >= 10 ? 1 : 2)] });
    }
    const answerRows = QUESTIONS.map((question) => [t("q." + question.key), answerLabel(question, screening.answers[question.key])]);
    const tapR = r.tapRight;
    const tapL = r.tapLeft;
    const measureRows =
    [
        [t("m.speed") + " (" + t("m.speed.unit") + ")", sideValue(tapR, (x) => x.rate, 1), sideValue(tapL, (x) => x.rate, 1)],
        [t("m.size") + " (cm)", sideValue(tapR, (x) => x.meanAmplitude, 1), sideValue(tapL, (x) => x.meanAmplitude, 1)],
        [t("m.decrement") + " (%)", sideValue(tapR, (x) => -x.decrementPct, 0, signed), sideValue(tapL, (x) => -x.decrementPct, 0, signed)],
        [t("m.rhythm") + " (%)", sideValue(tapR, (x) => x.intervalCv, 0), sideValue(tapL, (x) => x.intervalCv, 0)],
        [t("m.pauses"), sideValue(tapR, (x) => x.pauses, 0), sideValue(tapL, (x) => x.pauses, 0)],
        [t("report.restTremor"), tremorCell(r.tremorRest && r.tremorRest.right), tremorCell(r.tremorRest && r.tremorRest.left)],
        [t("report.postureTremor"), tremorCell(r.tremorPosture && r.tremorPosture.right), tremorCell(r.tremorPosture && r.tremorPosture.left)],
        [t("m.drawTremor"), spiralTremorCell(r.spiralRight), spiralTremorCell(r.spiralLeft)],
        [t("m.lineError") + " (%)", sideValue(r.spiralRight, (x) => x.templateErrorPct, 0), sideValue(r.spiralLeft, (x) => x.templateErrorPct, 0)]
    ];
    const face = r.face && r.face.ok ? r.face : null;
    const voice = r.voice || {};
    const reading = voice.reading && voice.reading.ok ? voice.reading : null;
    const ddk = voice.ddk && voice.ddk.ok ? voice.ddk : null;
    const vowel = voice.vowel && voice.vowel.ok ? voice.vowel : null;
    const singleRows =
    [
        [t("m.blinkRate"), face ? fmt(face.blinkRate, 0) : NA()],
        [t("m.smile") + " (%)", face ? fmt(face.smileAmplitude * 100, 0) : NA()],
        [t("m.brow") + " (%)", face ? fmt(face.browAmplitude * 100, 0) : NA()],
        [t("m.rise") + " (s)", face ? fmt(face.riseMs / 1000, 1) : NA()],
        [t("m.pitchVar") + " (" + t("m.pitchVar.unit") + ")", reading ? fmt(reading.f0SdSemitones, 1) : NA()],
        [t("m.pausing") + " (%)", reading ? fmt(reading.pauseRatio * 100, 0) : NA()],
        [t("m.ddkRate"), ddk ? fmt(ddk.syllableRate, 1) : NA()],
        [t("m.wobble") + " (%)", vowel ? fmt(vowel.perturbationPct, 1) : NA()],
        [t("m.clarity") + " (dB)", vowel ? fmt(vowel.hnrDb, 0) : NA()]
    ];
    const tapCharts = [["right", tapR], ["left", tapL]].filter(([, result]) => result && result.ok).map(([side, result]) =>
        panel(t("chart.tapSizes") + ", " + sideWord(side), "cm", barChart({ values: result.taps.map((tap) => tap.amplitude), fit: result.fit, height: 130, xLabel: t("chart.tapNumber") })));
    const findings = motor.flags.length ? motor.flags.map((flag) => t("flag." + flag.id) + (flag.sides && flag.sides.length ? " (" + flag.sides.map((side) => sideWord(side)).join(", ") + ")" : "")) : [t("results.noFlags")];
    return h("article", { class: "report" },
        toolbar(),
        head("report.screening", [t("report.created", { date: formatDate(screening.completedAt || screening.startedAt, false) }), t("report.patient", { age: screening.age }) + ", " + sexLabel.toLowerCase()]),
        h("section", { class: "section report-summary" }, h("h2", null, tierTitle), estimate),
        summary.mode === "risk" ? h("section", { class: "section" }, h("h2", null, t("results.shaped")), table([t("report.factor"), t("report.lr")], factorRows)) : null,
        h("section", { class: "section" }, h("h2", null, t("results.movement")),
            h("ul", { class: "report-list" }, findings.map((item) => h("li", null, item))),
            h("p", { class: "small quiet report-note" }, t("results.motorRule"))),
        h("section", { class: "section" }, h("h2", null, t("report.measures")),
            table([t("report.measure"), t("common.right"), t("common.left")], measureRows),
            h("div", { class: "report-gap" }, table([t("report.measure"), t("report.value")], singleRows))),
        tapCharts.length ? h("section", { class: "section two-col" }, tapCharts) : null,
        h("section", { class: "section" }, h("h2", null, t("report.answers")), table([t("report.question"), t("report.answer")], answerRows)),
        h("section", { class: "section" }, h("h2", null, t("report.method.title")), h("p", { class: "small" }, t("report.method.body"))),
        h("p", { class: "section small quiet" }, t("report.disclaimer")));
}

export function trackReportView()
{
    const track = getState().track;
    const checks = track.checks.slice().sort((a, b) => a.at - b.at);
    const doses = track.doses.slice().sort((a, b) => a.at - b.at);
    if (checks.length === 0)
    {
        return h("p", null, t("report.none"));
    }
    const days = Math.max(1, Math.round((checks[checks.length - 1].at - checks[0].at) / TIME.DAY) + 1);
    const speeds = checks.map(checkSpeed).filter((v) => isFinite(v));
    const tremors = checks.map(checkTremor).filter((v) => isFinite(v));
    const points = checks.map((check) => ({ x: hoursSinceDose(check, doses), y: checkSpeed(check), tremor: checkTremor(check) })).filter((p) => p.x !== null && isFinite(p.y));
    const windows = [[0, 1], [1, 2], [2, 3], [3, 4], [4, Infinity]];
    const windowRows = windows.map(([a, b]) =>
    {
        const inside = points.filter((p) => p.x >= a && p.x < b);
        const tremorValues = inside.map((p) => p.tremor).filter((v) => isFinite(v));
        const label = isFinite(b) ? t("report.range", { a, b }) : t("report.rangeOpen", { a });
        return [label, String(inside.length), inside.length ? fmt(mean(inside.map((p) => p.y)), 2) : NA(), tremorValues.length ? fmt(mean(tremorValues), 1) : NA()];
    });
    const chart = points.length >= 6 ? panel(t("track.byDose"), t("m.speed.unit"), scatterChart({ points: points.map((p) => ({ x: p.x, y: p.y })), curve: doseCurve(points), xDomain: doseDomain(points), xLabel: t("track.hoursAxis"), yFormat: (y) => fmt(y, 1), height: 200 }), [{ kind: "dot", label: t("chart.each") }, { kind: "line", label: t("chart.averageCurve") }]) : null;
    const example = checks.some((c) => c.example);
    return h("article", { class: "report" },
        toolbar(),
        head("report.tracking", [t("report.created", { date: formatDate(Date.now(), false) }), t("report.checks", { n: checks.length, d: days })]),
        example ? h("p", { class: "section" }, h("span", { class: "example-tag" }, t("track.example.tag"))) : null,
        h("section", { class: "section readouts readouts-3" },
            readout(t("report.avgSpeed"), fmt(mean(speeds), 1), t("m.speed.unit"), false),
            readout(t("track.latest"), fmt(speeds[speeds.length - 1], 1), t("m.speed.unit"), false),
            readout(t("report.avgTremor"), tremors.length ? fmt(mean(tremors), 1) : NA(), tremors.length ? "mm" : null, false)),
        chart ? h("section", { class: "section" }, chart) : null,
        h("section", { class: "section" }, h("h2", null, t("report.trackTable")),
            table([t("report.window"), t("report.count"), t("m.speed.unit"), t("report.tremorMm")], windowRows)),
        h("p", { class: "section small quiet" }, t("track.byDose.note")),
        h("p", { class: "section small quiet" }, t("report.disclaimer")));
}
