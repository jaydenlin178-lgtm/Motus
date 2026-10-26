const PALM = [0, 5, 9, 13, 17];
const TIPS = [4, 8, 12, 16, 20];

function centroid(points, indices)
{
    let x = 0;
    let y = 0;
    for (const index of indices)
    {
        x += points[index].x;
        y += points[index].y;
    }
    const center = { x: x / indices.length, y: y / indices.length };
    return center;
}

function distance3(a, b)
{
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

export function handsFromResult(result, width, height)
{
    if (!result || !result.landmarks || result.landmarks.length === 0)
    {
        return [];
    }
    const hands = [];
    for (let i = 0; i < result.landmarks.length; i++)
    {
        const image = result.landmarks[i];
        const world = result.worldLandmarks && result.worldLandmarks[i] ? result.worldLandmarks[i] : null;
        const px = image.map((p) => ({ x: p.x * width, y: p.y * height }));
        const palmLengthPx = Math.hypot(px[0].x - px[9].x, px[0].y - px[9].y);
        const palmLengthM = world ? distance3(world[0], world[9]) : NaN;
        const gapCm = world ? distance3(world[4], world[8]) * 100 : NaN;
        const palm = centroid(px, PALM);
        const tips = centroid(px, TIPS);
        hands.push(
        {
            image,
            px,
            palmLengthPx,
            relativeSize: palmLengthPx / Math.max(width, height),
            gapCm,
            palmX: palm.x,
            palmY: palm.y,
            tipX: tips.x,
            tipY: tips.y,
            mmPerPx: palmLengthPx > 0 && isFinite(palmLengthM) ? palmLengthM * 1000 / palmLengthPx : NaN,
            normalizedX: palm.x / width
        });
    }
    return hands;
}

export function assignSides(hands)
{
    const sides = { right: null, left: null };
    if (hands.length === 1)
    {
        if (hands[0].normalizedX < 0.5)
        {
            sides.right = hands[0];
        }
        else
        {
            sides.left = hands[0];
        }
    }
    else if (hands.length >= 2)
    {
        const sorted = hands.slice(0, 2).sort((a, b) => a.normalizedX - b.normalizedX);
        sides.right = sorted[0];
        sides.left = sorted[1];
    }
    return sides;
}

export function faceFromResult(result)
{
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0)
    {
        return null;
    }
    const scores = {};
    const shapes = result.faceBlendshapes && result.faceBlendshapes[0] ? result.faceBlendshapes[0].categories : [];
    for (const category of shapes)
    {
        scores[category.categoryName] = category.score;
    }
    const read = (name) => scores[name] || 0;
    const face =
    {
        landmarks: result.faceLandmarks[0],
        blink: (read("eyeBlinkLeft") + read("eyeBlinkRight")) / 2,
        smileL: read("mouthSmileLeft"),
        smileR: read("mouthSmileRight"),
        brow: Math.max(read("browInnerUp"), (read("browOuterUpLeft") + read("browOuterUpRight")) / 2),
        mouth: read("jawOpen")
    };
    return face;
}
