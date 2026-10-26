import { createRandom } from "./signals.js";

const HAND_SHAPE =
[
    [0, 0.5], [-0.18, 0.38], [-0.3, 0.24], [-0.38, 0.1], [-0.44, -0.02],
    [-0.12, 0], [-0.14, -0.22], [-0.15, -0.36], [-0.16, -0.48],
    [0, -0.02], [0, -0.26], [0, -0.42], [0, -0.55],
    [0.11, 0], [0.12, -0.21], [0.13, -0.35], [0.13, -0.46],
    [0.21, 0.05], [0.24, -0.11], [0.26, -0.22], [0.27, -0.31]
];

const PROFILES =
{
    "tap-right": { rate: 3.4, amplitude: 6.4, decrement: 0.05 },
    "tap-left": { rate: 2.35, amplitude: 4.6, decrement: 0.42 },
    "tremor-rest": { right: { hz: 0, mm: 0 }, left: { hz: 4.9, mm: 3.4 } },
    "tremor-posture": { right: { hz: 0, mm: 0 }, left: { hz: 5.2, mm: 1.2 } },
    "tap-feedback": { rate: 2.9, amplitude: 5.8, decrement: 0.22 }
};

const bigPosition = { x: 0.5, y: 0.5 };

const random = createRandom(97);

function gaussian()
{
    const u = Math.max(random(), 1e-12);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createFakeCameraSource()
{
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, "#2b3550");
    gradient.addColorStop(1, "#151c30");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.ellipse(320, 200, 110, 140, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(170, 330, 300, 200);
    const fakeSource =
    {
        element: canvas,
        width: 640,
        height: 480,
        isVideo: false,
        stop()
        {
            return null;
        }
    };
    return fakeSource;
}

function buildHand(centerX, centerY, scale, gapCm, shiftX, shiftY)
{
    const image = HAND_SHAPE.map(([x, y]) => ({ x: centerX + x * scale + shiftX, y: centerY + y * scale * 1.33 + shiftY, z: 0 }));
    const metersPerUnit = 0.09 / 0.52;
    const world = HAND_SHAPE.map(([x, y]) => ({ x: x * metersPerUnit, y: y * metersPerUnit, z: 0 }));
    const half = gapCm / 200;
    const pinch = { x: -0.28 * metersPerUnit, y: -0.26 * metersPerUnit, z: 0 };
    world[4] = { x: pinch.x - half * 0.7, y: pinch.y + half * 0.7, z: 0 };
    world[8] = { x: pinch.x + half * 0.7, y: pinch.y - half * 0.7, z: 0 };
    const openness = Math.min(1, gapCm / 7);
    image[4] = { x: centerX + (-0.3 - 0.14 * openness) * scale + shiftX, y: centerY + (-0.22 + 0.2 * openness) * scale * 1.33 + shiftY, z: 0 };
    image[8] = { x: centerX + (-0.2 + 0.04 * openness) * scale + shiftX, y: centerY + (-0.26 - 0.22 * openness) * scale * 1.33 + shiftY, z: 0 };
    const hand = { image, world };
    return hand;
}

export function createFakeHandTracker(getActivity)
{
    const tracker =
    {
        detectForVideo(element, timestamp)
        {
            const activity = getActivity();
            const name = activity ? activity.name : "idle";
            const elapsed = activity ? (timestamp - activity.startedAt) / 1000 : 0;
            const landmarks = [];
            const worldLandmarks = [];
            if (name.startsWith("tap") || name === "idle")
            {
                const side = name.endsWith("left") ? "left" : "right";
                const profile = PROFILES[name] || PROFILES["tap-right"];
                const progress = Math.min(1, elapsed / 10);
                const recording = activity && activity.details && activity.details.recording;
                const size = profile.amplitude * (1 - profile.decrement * progress);
                const openness = recording ? 0.5 - 0.5 * Math.cos(2 * Math.PI * profile.rate * elapsed) : 0.55;
                const gap = 0.4 + size * openness + gaussian() * 0.12;
                const hand = buildHand(side === "right" ? 0.42 : 0.58, 0.5, 0.36, gap, 0, 0);
                landmarks.push(hand.image);
                worldLandmarks.push(hand.world);
            }
            else if (name.startsWith("big"))
            {
                const details = activity && activity.details ? activity.details : {};
                let goal = { x: 0.5, y: 0.52 };
                if (name === "big-measure")
                {
                    goal = { x: 0.5 + 0.16 * Math.sin(elapsed * 1.9), y: 0.5 + 0.12 * Math.sin(elapsed * 2.7) };
                }
                else if (name === "big-practice" && details.target)
                {
                    goal = details.target;
                }
                bigPosition.x += (goal.x - bigPosition.x) * 0.1;
                bigPosition.y += (goal.y - bigPosition.y) * 0.1;
                const hand = buildHand(bigPosition.x - 0.009, bigPosition.y - 0.031, 0.22, 3, 0, 0);
                landmarks.push(hand.image);
                worldLandmarks.push(hand.world);
            }
            else if (name.startsWith("tremor"))
            {
                const profile = PROFILES[name];
                for (const side of ["right", "left"])
                {
                    const spec = profile[side];
                    const mmPerUnit = 90 / 0.52;
                    const amplitudeUnits = spec.mm / 2 / mmPerUnit;
                    const wave = Math.sin(2 * Math.PI * spec.hz * elapsed);
                    const shiftX = amplitudeUnits * wave * 0.3 + gaussian() * 0.0012;
                    const shiftY = amplitudeUnits * wave * 0.25 + gaussian() * 0.0012;
                    const hand = buildHand(side === "right" ? 0.28 : 0.72, 0.56, 0.3, 1.5, shiftX, shiftY);
                    landmarks.push(hand.image);
                    worldLandmarks.push(hand.world);
                }
            }
            if (random() < 0.03)
            {
                const empty = { landmarks: [], worldLandmarks: [], handedness: [] };
                return empty;
            }
            const result = { landmarks, worldLandmarks, handedness: [] };
            return result;
        },
        close()
        {
            return null;
        }
    };
    return tracker;
}

function facePoints(smile, brow, blink)
{
    const points = [];
    for (let i = 0; i < 478; i++)
    {
        const angle = i / 478 * Math.PI * 2;
        points.push({ x: 0.5 + 0.17 * Math.cos(angle), y: 0.43 + 0.23 * Math.sin(angle), z: 0 });
    }
    const setRing = (indices, cx, cy, rx, ry) =>
    {
        indices.forEach((index, k) =>
        {
            const angle = k / indices.length * Math.PI * 2;
            points[index] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), z: 0 };
        });
    };
    const eyeOpen = 0.022 * (1 - blink);
    setRing([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], 0.44, 0.38, 0.04, Math.max(0.002, eyeOpen));
    setRing([263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466], 0.56, 0.38, 0.04, Math.max(0.002, eyeOpen));
    setRing([61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185], 0.5, 0.55 - smile * 0.01, 0.06 + smile * 0.025, 0.018 + smile * 0.012);
    [70, 63, 105, 66, 107].forEach((index, k) =>
    {
        points[index] = { x: 0.4 + k * 0.022, y: 0.335 - brow * 0.03 - Math.sin(k / 4 * Math.PI) * 0.008, z: 0 };
    });
    [336, 296, 334, 293, 300].forEach((index, k) =>
    {
        points[index] = { x: 0.512 + k * 0.022, y: 0.335 - brow * 0.03 - Math.sin(k / 4 * Math.PI) * 0.008, z: 0 };
    });
    return points;
}

export function createFakeFaceTracker(getActivity)
{
    const tracker =
    {
        detectForVideo(element, timestamp)
        {
            const activity = getActivity();
            const details = activity && activity.details ? activity.details : {};
            const elapsedMs = activity ? timestamp - activity.startedAt : 0;
            let blink = 0.06 + random() * 0.04;
            if (details.recording && elapsedMs < (details.neutralMs || 30000) && elapsedMs % 5200 < 160)
            {
                blink = 0.82;
            }
            let smile = 0.05 + random() * 0.02;
            let brow = 0.06 + random() * 0.02;
            let jaw = 0.03 + random() * 0.02;
            for (const cue of details.cues || [])
            {
                const since = elapsedMs - cue.at;
                if (details.recording && since >= 0 && since <= 2600)
                {
                    const level = Math.min(1, since / 650);
                    if (cue.type === "smile")
                    {
                        smile = Math.max(smile, 0.52 * level);
                    }
                    else if (cue.type === "brow")
                    {
                        brow = Math.max(brow, 0.4 * level);
                    }
                    else if (cue.type === "mouth")
                    {
                        jaw = Math.max(jaw, 0.55 * level);
                    }
                }
            }
            const categories =
            [
                { categoryName: "eyeBlinkLeft", score: blink },
                { categoryName: "eyeBlinkRight", score: blink },
                { categoryName: "mouthSmileLeft", score: smile },
                { categoryName: "mouthSmileRight", score: smile * 0.93 },
                { categoryName: "browInnerUp", score: brow },
                { categoryName: "browOuterUpLeft", score: brow * 0.8 },
                { categoryName: "browOuterUpRight", score: brow * 0.8 },
                { categoryName: "jawOpen", score: jaw }
            ];
            const result = { faceLandmarks: [facePoints(smile, brow, blink)], faceBlendshapes: [{ categories }], facialTransformationMatrixes: [] };
            return result;
        },
        close()
        {
            return null;
        }
    };
    return tracker;
}
