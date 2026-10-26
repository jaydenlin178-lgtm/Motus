import { h, formatNumber } from "../ui.js";
import { icon } from "../icons.js";
import { t, currentLang, sideWord } from "../i18n.js";
import { lineChart, barChart, mountChart, spiralFigure } from "../charts.js";
import { THRESHOLDS } from "../analysis/flags.js";

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

export function readout(label, value, unit, flagged)
{
    const word = !/\d/.test(String(value));
    return h("div", { class: "readout" + (flagged ? " is-flagged" : "") },
        h("div", { class: "readout-value" + (word ? " is-word" : "") }, h("span", { class: "value" }, value), unit && !word ? h("span", { class: "readout-unit" }, unit) : null),
        h("div", { class: "readout-label" }, label));
}

export function chartLegend(items)
{
    return h("div", { class: "chart-legend" }, items.map((item) =>
        h("span", null, h("i", { class: "key key-" + item.kind, "aria-hidden": "true" }), item.label)));
}

export function panel(title, note, chartRender, legendItems)
{
    const host = h("div");
    mountChart(host, chartRender);
    return h("div", { class: "panel graph-paper" },
        h("div", { class: "panel-title" }, h("span", null, title), note ? h("span", { class: "quiet" }, note) : null),
        host,
        legendItems && legendItems.length ? chartLegend(legendItems) : null);
}

function block(iconName, title, options, ...content)
{
    const showHeading = !options || options.heading !== false;
    return h("section", { class: showHeading ? "result-block" : "result-block is-bare" },
        showHeading ? h("h3", null, icon(iconName), title) : null,
        content);
}

function decrementFlagged(result)
{
    return result.tapCount >= 8 && result.decrementPct >= THRESHOLDS.decrementPct && result.decrementP < THRESHOLDS.decrementP;
}

export function tappingReadouts(result)
{
    const slow = result.rate < THRESHOLDS.slowTappingRate;
    return h("div", { class: "readouts" },
        readout(t("m.speed"), fmt(result.rate, 1), t("m.speed.unit"), slow),
        readout(t("m.size"), fmt(result.meanAmplitude, 1), "cm", false),
        readout(t("m.decrement"), (result.decrementPct > 0 ? "−" : "+") + fmt(Math.abs(result.decrementPct), 0), "%", decrementFlagged(result)),
        readout(t("m.rhythm"), fmt(result.intervalCv, 0), "%", result.intervalCv > THRESHOLDS.irregularCv));
}

export function tappingCharts(result)
{
    const shrink = decrementFlagged(result);
    const trace = panel(t("chart.tapTrace"), "cm", lineChart(
    {
        xs: result.trace.times,
        ys: result.trace.values,
        yMin: 0,
        height: 150,
        xLabel: t("chart.seconds"),
        tooltip: (x, y) => [fmt(y, 1) + " cm", fmt(x, 1) + " s"]
    }));
    const sizes = panel(t("chart.tapSizes"), "cm", barChart(
    {
        values: result.taps.map((tap) => tap.amplitude),
        fit: result.fit,
        flagged: shrink,
        height: 150,
        xLabel: t("chart.tapNumber"),
        tooltip: (i, value) => [fmt(value, 1) + " cm", "#" + (i + 1)]
    }), result.fit ? [{ kind: shrink ? "dash-flagged" : "dash", label: t("chart.trend") }] : null);
    return h("div", { class: "stack" }, trace, sizes);
}

export function tappingBlock(result, side, options)
{
    return block("hand", t("tap.title", { side: sideWord(side) }), options,
        result && result.ok ? h("div", { class: "stack" }, tappingReadouts(result), tappingCharts(result)) : h("p", { class: "quiet" }, t("results.skipped")));
}

function tremorText(hand)
{
    if (!hand || !hand.ok)
    {
        return t("results.skipped");
    }
    if (!hand.detected)
    {
        return t("tremor.none");
    }
    return t("tremor.found", { f: fmt(hand.frequency, 1) }) + ", " + fmt(hand.amplitudeMm, 1) + " mm";
}

export function tremorBlock(rest, posture, options)
{
    const rows = [];
    const phases = [["tremor.phase.rest", rest], ["tremor.phase.posture", posture]];
    let strongest = null;
    for (const [labelKey, phase] of phases)
    {
        if (!phase)
        {
            continue;
        }
        for (const side of ["right", "left"])
        {
            const hand = phase[side];
            const flagged = labelKey === "tremor.phase.rest" && hand && hand.ok && hand.parkinsonianRange;
            rows.push(h("div", { class: "finding" + (flagged ? " is-flagged" : " is-clear") },
                icon(hand && hand.detected ? "tremor" : "check"),
                h("div", null, h("strong", null, tremorText(hand)), h("p", null, t(labelKey) + ", " + sideWord(side)))));
            if (hand && hand.ok && (!strongest || (hand.detected && (!strongest.hand.detected || hand.amplitudeMm > strongest.hand.amplitudeMm))))
            {
                strongest = { hand, side, labelKey };
            }
        }
    }
    const chart = strongest ? panel(t("chart.spectrum"), t(strongest.labelKey) + ", " + sideWord(strongest.side), lineChart(
    {
        xs: strongest.hand.spectrum.freqs,
        ys: strongest.hand.spectrum.power,
        yMin: 0,
        yMax: 1.1,
        area: true,
        height: 160,
        band: [3.5, 7.5],
        xLabel: t("chart.hz"),
        yFormat: () => "",
        markers: strongest.hand.detected ? [{ x: strongest.hand.frequency, y: 1, label: fmt(strongest.hand.frequency, 1) + " Hz" }] : [],
        tooltip: (x, y) => [fmt(x, 1) + " Hz", fmt(y * 100, 0) + "%"]
    }), [{ kind: "band", label: t("chart.pdBand") }]) : null;
    return block("tremor", t("tremor.title"), options,
        rows.length ? h("div", null, rows) : h("p", { class: "quiet" }, t("results.skipped")),
        chart ? h("div", { class: "block-chart" }, chart) : null);
}

export function faceBlock(result, options)
{
    if (!result || !result.ok)
    {
        return block("face", t("face.title"), options, h("p", { class: "quiet" }, t("results.skipped")));
    }
    const reduced = result.smileAmplitude < THRESHOLDS.reducedSmile && result.browAmplitude < THRESHOLDS.reducedBrow;
    return block("face", t("face.title"), options,
        h("div", { class: "readouts" },
            readout(t("m.blinkRate"), fmt(result.blinkRate, 0), "/min", result.blinkRate < THRESHOLDS.lowBlinkRate),
            readout(t("m.smile"), fmt(result.smileAmplitude * 100, 0), "%", reduced),
            readout(t("m.brow"), fmt(result.browAmplitude * 100, 0), "%", reduced),
            readout(t("m.rise"), fmt(result.riseMs / 1000, 1), "s", result.riseMs > THRESHOLDS.slowRiseMs)),
        h("div", { class: "block-chart" }, panel(t("chart.blinks"), null, lineChart(
        {
            xs: result.traces.blink.map((_, i) => i / Math.max(1, result.traces.blink.length - 1) * result.neutralSeconds),
            ys: result.traces.blink,
            yMin: 0,
            yMax: 1.05,
            height: 130,
            xLabel: t("chart.seconds"),
            yFormat: () => "",
            tooltip: (x, y) => [fmt(y * 100, 0) + "%", fmt(x, 1) + " s"]
        }))));
}

export function voiceBlock(voice, options)
{
    if (!voice || (!voice.reading && !voice.vowel && !voice.ddk))
    {
        return block("mic", t("voice.title"), options, h("p", { class: "quiet" }, t("results.skipped")));
    }
    const reading = voice.reading && voice.reading.ok ? voice.reading : null;
    const vowel = voice.vowel && voice.vowel.ok ? voice.vowel : null;
    const ddk = voice.ddk && voice.ddk.ok ? voice.ddk : null;
    const items = [];
    if (reading)
    {
        items.push(readout(t("m.pitchVar"), fmt(reading.f0SdSemitones, 1), t("m.pitchVar.unit"), reading.f0SdSemitones < THRESHOLDS.monotoneSemitones));
        items.push(readout(t("m.pausing"), fmt(reading.pauseRatio * 100, 0), "%", false));
    }
    if (ddk)
    {
        items.push(readout(t("m.ddkRate"), fmt(ddk.syllableRate, 1), null, ddk.syllableRate < THRESHOLDS.slowDdkRate));
    }
    if (vowel)
    {
        items.push(readout(t("m.wobble"), fmt(vowel.perturbationPct, 1), "%", false));
        items.push(readout(t("m.clarity"), fmt(vowel.hnrDb, 0), "dB", false));
    }
    const chart = reading ? panel(t("chart.pitch"), t("m.pitchVar.unit"), lineChart(
    {
        xs: reading.contour.map((_, i) => i / Math.max(1, reading.contour.length - 1) * reading.duration),
        ys: reading.contour,
        height: 150,
        xLabel: t("chart.seconds"),
        tooltip: (x, y) => [fmt(y, 1) + " " + t("m.pitchVar.unit"), fmt(x, 1) + " s"]
    })) : null;
    return block("mic", t("voice.title"), options,
        h("div", { class: "readouts" }, items),
        chart ? h("div", { class: "block-chart" }, chart) : null);
}

export function spiralBlock(result, side, drawing, options)
{
    const title = t("spiral.titleSide", { side: sideWord(side) });
    if (!result || !result.ok)
    {
        return block("spiral", title, options, h("p", { class: "quiet" }, t("results.skipped")));
    }
    const figure = drawing ? h("div", { class: "panel graph-paper spiral-figure" }, spiralFigure(drawing.points, drawing.template, 220)) : null;
    return block("spiral", title, options,
        h("div", { class: drawing ? "two-col" : "" },
            h("div", { class: "readouts", style: { alignContent: "start" } },
                readout(t("m.drawTime"), fmt(result.durationS, 1), "s", false),
                readout(t("m.lineError"), fmt(result.templateErrorPct, 0), "%", false),
                readout(t("m.drawTremor"), result.tremor.detected ? fmt(result.tremor.frequency, 1) : t("m.none"), result.tremor.detected ? "Hz" : null, result.tremor.detected)),
            figure));
}
