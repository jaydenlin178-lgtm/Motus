export function sum(values)
{
    let total = 0;
    for (let i = 0; i < values.length; i++)
    {
        total += values[i];
    }
    return total;
}

export function mean(values)
{
    if (!values || values.length === 0)
    {
        return NaN;
    }
    return sum(values) / values.length;
}

export function variance(values)
{
    const n = values.length;
    if (n < 2)
    {
        return NaN;
    }
    const m = mean(values);
    let acc = 0;
    for (let i = 0; i < n; i++)
    {
        const d = values[i] - m;
        acc += d * d;
    }
    return acc / (n - 1);
}

export function std(values)
{
    return Math.sqrt(variance(values));
}

export function percentile(values, p)
{
    if (!values || values.length === 0)
    {
        return NaN;
    }
    const sorted = Array.from(values).sort((a, b) => a - b);
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export function median(values)
{
    return percentile(values, 50);
}

export function coefficientOfVariation(values)
{
    const m = mean(values);
    if (!isFinite(m) || m === 0)
    {
        return NaN;
    }
    return std(values) / m;
}

export function clamp(value, lo, hi)
{
    return Math.min(hi, Math.max(lo, value));
}

export function rms(values, start = 0, end = values.length)
{
    let acc = 0;
    for (let i = start; i < end; i++)
    {
        acc += values[i] * values[i];
    }
    const n = end - start;
    return n > 0 ? Math.sqrt(acc / n) : 0;
}

function logGamma(x)
{
    const coefficients = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let series = 1.000000000190015;
    for (let j = 0; j < 6; j++)
    {
        y += 1;
        series += coefficients[j] / y;
    }
    return -tmp + Math.log(2.5066282746310005 * series / x);
}

function betaContinuedFraction(a, b, x)
{
    const maxIterations = 300;
    const epsilon = 3e-14;
    const tiny = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < tiny)
    {
        d = tiny;
    }
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIterations; m++)
    {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny)
        {
            d = tiny;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < tiny)
        {
            c = tiny;
        }
        d = 1 / d;
        h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny)
        {
            d = tiny;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < tiny)
        {
            c = tiny;
        }
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < epsilon)
        {
            break;
        }
    }
    return h;
}

export function incompleteBeta(a, b, x)
{
    if (x <= 0)
    {
        return 0;
    }
    if (x >= 1)
    {
        return 1;
    }
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2))
    {
        return front * betaContinuedFraction(a, b, x) / a;
    }
    return 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
}

export function studentTwoTailedP(t, degreesOfFreedom)
{
    if (!isFinite(t))
    {
        return 0;
    }
    const x = degreesOfFreedom / (degreesOfFreedom + t * t);
    return incompleteBeta(degreesOfFreedom / 2, 0.5, x);
}

export function linearRegression(xs, ys)
{
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let i = 0; i < n; i++)
    {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        sxx += dx * dx;
        sxy += dx * dy;
        syy += dy * dy;
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const intercept = my - slope * mx;
    const residual = Math.max(0, syy - slope * sxy);
    const r2 = syy === 0 ? 0 : 1 - residual / syy;
    let pValue = NaN;
    if (n > 2 && sxx > 0)
    {
        const standardError = Math.sqrt(residual / (n - 2) / sxx);
        const t = standardError === 0 ? Infinity : slope / standardError;
        pValue = studentTwoTailedP(t, n - 2);
    }
    const fit = { slope, intercept, r2, pValue, n };
    return fit;
}

export function interpolateGaps(times, values)
{
    const keptTimes = [];
    const keptValues = [];
    for (let i = 0; i < values.length; i++)
    {
        if (values[i] !== null && values[i] !== undefined && isFinite(values[i]))
        {
            keptTimes.push(times[i]);
            keptValues.push(values[i]);
        }
    }
    const result = { times: keptTimes, values: keptValues };
    return result;
}

export function resampleUniform(times, values, rate)
{
    const start = times[0];
    const end = times[times.length - 1];
    const step = 1000 / rate;
    const count = Math.max(1, Math.floor((end - start) / step) + 1);
    const out = new Float64Array(count);
    let j = 0;
    for (let i = 0; i < count; i++)
    {
        const t = start + i * step;
        while (j < times.length - 2 && times[j + 1] < t)
        {
            j++;
        }
        const t0 = times[j];
        const t1 = times[Math.min(j + 1, times.length - 1)];
        const v0 = values[j];
        const v1 = values[Math.min(j + 1, values.length - 1)];
        const fraction = t1 === t0 ? 0 : clamp((t - t0) / (t1 - t0), 0, 1);
        out[i] = v0 + (v1 - v0) * fraction;
    }
    const series = { start, rate, values: out };
    return series;
}

export function biquadCoefficients(type, cutoff, rate, q = Math.SQRT1_2)
{
    const w0 = 2 * Math.PI * cutoff / rate;
    const cosW = Math.cos(w0);
    const sinW = Math.sin(w0);
    const alpha = sinW / (2 * q);
    let b0;
    let b1;
    let b2;
    if (type === "lowpass")
    {
        b0 = (1 - cosW) / 2;
        b1 = 1 - cosW;
        b2 = (1 - cosW) / 2;
    }
    else if (type === "highpass")
    {
        b0 = (1 + cosW) / 2;
        b1 = -(1 + cosW);
        b2 = (1 + cosW) / 2;
    }
    else
    {
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const coefficients = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cosW / a0, a2: (1 - alpha) / a0 };
    return coefficients;
}

function runBiquad(values, c)
{
    const out = new Float64Array(values.length);
    const first = values.length ? values[0] : 0;
    const gain = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2);
    let x1 = first;
    let x2 = first;
    let y1 = isFinite(gain) ? first * gain : 0;
    let y2 = y1;
    for (let i = 0; i < values.length; i++)
    {
        const x0 = values[i];
        const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        out[i] = y0;
        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
    }
    return out;
}

function reflectPad(values, padLength)
{
    const n = values.length;
    const pad = Math.min(padLength, n - 1);
    const out = new Float64Array(n + 2 * pad);
    for (let i = 0; i < pad; i++)
    {
        out[i] = 2 * values[0] - values[pad - i];
    }
    for (let i = 0; i < n; i++)
    {
        out[pad + i] = values[i];
    }
    for (let i = 0; i < pad; i++)
    {
        out[pad + n + i] = 2 * values[n - 1] - values[n - 2 - i];
    }
    const padded = { values: out, pad };
    return padded;
}

export function filtfilt(values, type, cutoff, rate, order = 2)
{
    if (values.length < 4)
    {
        return Float64Array.from(values);
    }
    const c = biquadCoefficients(type, cutoff, rate);
    const passes = Math.max(1, Math.round(order / 2));
    const padded = reflectPad(values, Math.round(3 * rate / Math.max(cutoff, 0.1)));
    let signal = padded.values;
    for (let p = 0; p < passes; p++)
    {
        signal = runBiquad(signal, c);
        signal.reverse();
        signal = runBiquad(signal, c);
        signal.reverse();
    }
    return signal.slice(padded.pad, padded.pad + values.length);
}

export function bandpass(values, low, high, rate)
{
    const centered = subtractMean(values);
    const highPassed = filtfilt(centered, "highpass", low, rate, 2);
    return filtfilt(highPassed, "lowpass", high, rate, 2);
}

export function subtractMean(values)
{
    const m = mean(values);
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++)
    {
        out[i] = values[i] - m;
    }
    return out;
}

export function detrend(values)
{
    const xs = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++)
    {
        xs[i] = i;
    }
    const fit = linearRegression(xs, values);
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++)
    {
        out[i] = values[i] - (fit.intercept + fit.slope * i);
    }
    return out;
}

export function movingAverage(values, window)
{
    const half = Math.floor(window / 2);
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++)
    {
        let acc = 0;
        let count = 0;
        for (let k = i - half; k <= i + half; k++)
        {
            if (k >= 0 && k < values.length)
            {
                acc += values[k];
                count++;
            }
        }
        out[i] = acc / count;
    }
    return out;
}

export function derivative(values, rate)
{
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++)
    {
        const prev = values[Math.max(0, i - 1)];
        const next = values[Math.min(values.length - 1, i + 1)];
        const span = (Math.min(values.length - 1, i + 1) - Math.max(0, i - 1)) / rate;
        out[i] = span > 0 ? (next - prev) / span : 0;
    }
    return out;
}

export function nextPowerOfTwo(n)
{
    let size = 1;
    while (size < n)
    {
        size <<= 1;
    }
    return size;
}

export function hann(n)
{
    const w = new Float64Array(n);
    if (n === 1)
    {
        w[0] = 1;
        return w;
    }
    for (let i = 0; i < n; i++)
    {
        w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    }
    return w;
}

export function fft(re, im)
{
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++)
    {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1)
        {
            j ^= bit;
        }
        j ^= bit;
        if (i < j)
        {
            let tmp = re[i];
            re[i] = re[j];
            re[j] = tmp;
            tmp = im[i];
            im[i] = im[j];
            im[j] = tmp;
        }
    }
    for (let size = 2; size <= n; size <<= 1)
    {
        const angle = -2 * Math.PI / size;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);
        for (let start = 0; start < n; start += size)
        {
            let curRe = 1;
            let curIm = 0;
            for (let k = 0; k < size / 2; k++)
            {
                const evenIndex = start + k;
                const oddIndex = start + k + size / 2;
                const tRe = curRe * re[oddIndex] - curIm * im[oddIndex];
                const tIm = curRe * im[oddIndex] + curIm * re[oddIndex];
                re[oddIndex] = re[evenIndex] - tRe;
                im[oddIndex] = im[evenIndex] - tIm;
                re[evenIndex] += tRe;
                im[evenIndex] += tIm;
                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
}

export function powerSpectrum(values, rate, minimumSize = 0)
{
    const n = nextPowerOfTwo(Math.max(values.length, minimumSize));
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    const window = hann(values.length);
    const m = mean(values);
    let windowEnergy = 0;
    for (let i = 0; i < values.length; i++)
    {
        re[i] = (values[i] - m) * window[i];
        windowEnergy += window[i] * window[i];
    }
    fft(re, im);
    const bins = n / 2 + 1;
    const freqs = new Float64Array(bins);
    const power = new Float64Array(bins);
    for (let k = 0; k < bins; k++)
    {
        freqs[k] = k * rate / n;
        let p = (re[k] * re[k] + im[k] * im[k]) / (rate * windowEnergy);
        if (k > 0 && k < n / 2)
        {
            p *= 2;
        }
        power[k] = p;
    }
    const spectrum = { freqs, power, binWidth: rate / n };
    return spectrum;
}

export function addSpectra(a, b)
{
    const power = new Float64Array(a.power.length);
    for (let k = 0; k < power.length; k++)
    {
        power[k] = a.power[k] + b.power[k];
    }
    const spectrum = { freqs: a.freqs, power, binWidth: a.binWidth };
    return spectrum;
}

export function bandPower(spectrum, low, high)
{
    let total = 0;
    for (let k = 0; k < spectrum.freqs.length; k++)
    {
        const f = spectrum.freqs[k];
        if (f >= low && f <= high)
        {
            total += spectrum.power[k] * spectrum.binWidth;
        }
    }
    return total;
}

export function bandPeak(spectrum, low, high)
{
    let best = -1;
    for (let k = 1; k < spectrum.freqs.length - 1; k++)
    {
        const f = spectrum.freqs[k];
        if (f < low || f > high)
        {
            continue;
        }
        if (best < 0 || spectrum.power[k] > spectrum.power[best])
        {
            best = k;
        }
    }
    if (best < 0)
    {
        const empty = { frequency: NaN, power: 0, index: -1 };
        return empty;
    }
    const left = spectrum.power[best - 1];
    const center = spectrum.power[best];
    const right = spectrum.power[best + 1];
    const denominator = left - 2 * center + right;
    const offset = denominator === 0 ? 0 : clamp(0.5 * (left - right) / denominator, -0.5, 0.5);
    const peak = { frequency: (best + offset) * spectrum.binWidth, power: center, index: best };
    return peak;
}

export function findPeaks(values, options = {})
{
    const minDistance = Math.max(1, options.minDistance || 1);
    const minProminence = options.minProminence || 0;
    const n = values.length;
    const candidates = [];
    let i = 1;
    while (i < n - 1)
    {
        if (values[i] > values[i - 1])
        {
            let j = i;
            while (j + 1 < n && values[j + 1] === values[i])
            {
                j++;
            }
            if (j + 1 < n && values[j + 1] < values[i])
            {
                candidates.push(Math.floor((i + j) / 2));
            }
            i = j + 1;
        }
        else
        {
            i++;
        }
    }
    const withProminence = [];
    for (const index of candidates)
    {
        const height = values[index];
        let leftMin = height;
        for (let k = index - 1; k >= 0; k--)
        {
            if (values[k] > height)
            {
                break;
            }
            leftMin = Math.min(leftMin, values[k]);
        }
        let rightMin = height;
        for (let k = index + 1; k < n; k++)
        {
            if (values[k] > height)
            {
                break;
            }
            rightMin = Math.min(rightMin, values[k]);
        }
        const prominence = height - Math.max(leftMin, rightMin);
        if (prominence >= minProminence)
        {
            withProminence.push({ index, prominence, height });
        }
    }
    const byHeight = withProminence.slice().sort((a, b) => b.height - a.height);
    const kept = [];
    for (const peak of byHeight)
    {
        let tooClose = false;
        for (const other of kept)
        {
            if (Math.abs(other.index - peak.index) < minDistance)
            {
                tooClose = true;
                break;
            }
        }
        if (!tooClose)
        {
            kept.push(peak);
        }
    }
    kept.sort((a, b) => a.index - b.index);
    return kept;
}

export function windowedSincLowpass(cutoff, rate, taps)
{
    const kernel = new Float64Array(taps);
    const middle = (taps - 1) / 2;
    const fc = cutoff / rate;
    let total = 0;
    for (let i = 0; i < taps; i++)
    {
        const x = i - middle;
        const sinc = x === 0 ? 2 * Math.PI * fc : Math.sin(2 * Math.PI * fc * x) / x;
        const hamming = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1));
        kernel[i] = sinc * hamming;
        total += kernel[i];
    }
    for (let i = 0; i < taps; i++)
    {
        kernel[i] /= total;
    }
    return kernel;
}

export function decimate(samples, factor, rate)
{
    if (factor <= 1)
    {
        return Float64Array.from(samples);
    }
    const kernel = windowedSincLowpass(0.45 * rate / factor, rate, 63);
    const half = (kernel.length - 1) / 2;
    const count = Math.floor(samples.length / factor);
    const out = new Float64Array(count);
    for (let i = 0; i < count; i++)
    {
        const center = i * factor;
        let acc = 0;
        for (let k = 0; k < kernel.length; k++)
        {
            const index = center + k - half;
            if (index >= 0 && index < samples.length)
            {
                acc += samples[index] * kernel[k];
            }
        }
        out[i] = acc;
    }
    return out;
}

export function yin(frame, rate, minFrequency, maxFrequency, threshold = 0.15)
{
    const maxLag = Math.min(Math.floor(rate / minFrequency), Math.floor(frame.length / 2));
    const minLag = Math.max(2, Math.floor(rate / maxFrequency));
    const width = frame.length - maxLag;
    const difference = new Float64Array(maxLag + 1);
    for (let lag = 1; lag <= maxLag; lag++)
    {
        let acc = 0;
        for (let j = 0; j < width; j++)
        {
            const d = frame[j] - frame[j + lag];
            acc += d * d;
        }
        difference[lag] = acc;
    }
    const normalized = new Float64Array(maxLag + 1);
    normalized[0] = 1;
    let running = 0;
    for (let lag = 1; lag <= maxLag; lag++)
    {
        running += difference[lag];
        normalized[lag] = running > 0 ? difference[lag] * lag / running : 1;
    }
    let chosen = -1;
    for (let lag = minLag; lag <= maxLag; lag++)
    {
        if (normalized[lag] < threshold)
        {
            while (lag + 1 <= maxLag && normalized[lag + 1] < normalized[lag])
            {
                lag++;
            }
            chosen = lag;
            break;
        }
    }
    if (chosen < 0)
    {
        let best = minLag;
        for (let lag = minLag; lag <= maxLag; lag++)
        {
            if (normalized[lag] < normalized[best])
            {
                best = lag;
            }
        }
        chosen = best;
    }
    let refined = chosen;
    if (chosen > 1 && chosen < maxLag)
    {
        const a = normalized[chosen - 1];
        const b = normalized[chosen];
        const c = normalized[chosen + 1];
        const denominator = a - 2 * b + c;
        if (denominator !== 0)
        {
            refined = chosen + clamp(0.5 * (a - c) / denominator, -0.5, 0.5);
        }
    }
    const estimate = { frequency: rate / refined, aperiodicity: normalized[chosen], lag: chosen };
    return estimate;
}

export function normalizedAutocorrelation(frame, lag)
{
    let cross = 0;
    let energyA = 0;
    let energyB = 0;
    for (let j = 0; j + lag < frame.length; j++)
    {
        cross += frame[j] * frame[j + lag];
        energyA += frame[j] * frame[j];
        energyB += frame[j + lag] * frame[j + lag];
    }
    const denominator = Math.sqrt(energyA * energyB);
    return denominator > 0 ? cross / denominator : 0;
}

export function toDecibels(value, floor = 1e-9)
{
    return 20 * Math.log10(Math.max(value, floor));
}

export function semitonesFromMedian(frequencies)
{
    const reference = median(frequencies);
    return frequencies.map((f) => 12 * Math.log2(f / reference));
}

export function downsampleForPlot(values, maxPoints)
{
    if (values.length <= maxPoints)
    {
        return Array.from(values);
    }
    const out = [];
    const step = values.length / maxPoints;
    for (let i = 0; i < maxPoints; i++)
    {
        out.push(values[Math.floor(i * step)]);
    }
    return out;
}

export function round(value, digits = 1)
{
    if (!isFinite(value))
    {
        return value;
    }
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}
