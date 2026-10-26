const SEGMENTS = 4;

function percentile(values, p)
{
    if (!values.length)
    {
        return NaN;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[index];
}

export function letterSizes(points, width)
{
    if (points.length < 30)
    {
        return null;
    }
    const xs = points.map((p) => p.x);
    const x0 = percentile(xs, 0.02);
    const x1 = percentile(xs, 0.98);
    const span = x1 - x0;
    if (span < width * 0.4)
    {
        return null;
    }
    const sizes = [];
    for (let k = 0; k < SEGMENTS; k++)
    {
        const lo = x0 + k * span / SEGMENTS;
        const hi = lo + span / SEGMENTS;
        const ys = points.filter((p) => p.x >= lo && p.x <= hi).map((p) => p.y);
        if (ys.length < 5)
        {
            return null;
        }
        sizes.push(percentile(ys, 0.95) - percentile(ys, 0.05));
    }
    return sizes;
}

export function shrinkPct(sizes)
{
    return (sizes[0] - sizes[sizes.length - 1]) / sizes[0] * 100;
}
