import { isSimulated } from "../env.js";

const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let visionModule = null;
let fileset = null;
let handTracker = null;
let faceTracker = null;
let source = null;
let activity = null;

export class CameraError extends Error
{
    constructor(kind, cause)
    {
        super(kind);
        this.kind = kind;
        this.cause = cause;
    }
}

export function setActivity(name, details)
{
    activity = { name, details: details || {}, startedAt: performance.now() };
}

export function getActivity()
{
    return activity;
}

async function loadVision()
{
    if (!visionModule)
    {
        visionModule = await import("../../vendor/mediapipe/vision_bundle.js");
    }
    if (!fileset)
    {
        const base = new URL("vendor/mediapipe/wasm", document.baseURI).href;
        fileset = await visionModule.FilesetResolver.forVisionTasks(base);
    }
    return visionModule;
}

async function createWithFallback(factory, options)
{
    try
    {
        return await factory.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: "GPU" } });
    }
    catch (error)
    {
        return await factory.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } });
    }
}

export async function getHandTracker()
{
    if (handTracker)
    {
        return handTracker;
    }
    if (isSimulated())
    {
        const fake = await import("../sim/fake-vision.js");
        handTracker = fake.createFakeHandTracker(getActivity);
        return handTracker;
    }
    try
    {
        const vision = await loadVision();
        handTracker = await createWithFallback(vision.HandLandmarker,
        {
            baseOptions: { modelAssetPath: HAND_MODEL },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
    }
    catch (error)
    {
        throw new CameraError("model", error);
    }
    return handTracker;
}

export async function getFaceTracker()
{
    if (faceTracker)
    {
        return faceTracker;
    }
    if (isSimulated())
    {
        const fake = await import("../sim/fake-vision.js");
        faceTracker = fake.createFakeFaceTracker(getActivity);
        return faceTracker;
    }
    try
    {
        const vision = await loadVision();
        faceTracker = await createWithFallback(vision.FaceLandmarker,
        {
            baseOptions: { modelAssetPath: FACE_MODEL },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true
        });
    }
    catch (error)
    {
        throw new CameraError("model", error);
    }
    return faceTracker;
}

export async function openCamera()
{
    if (source)
    {
        return source;
    }
    if (isSimulated())
    {
        const fake = await import("../sim/fake-vision.js");
        source = fake.createFakeCameraSource();
        return source;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    {
        throw new CameraError("unsupported");
    }
    let stream;
    try
    {
        stream = await navigator.mediaDevices.getUserMedia(
        {
            audio: false,
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }
        });
    }
    catch (error)
    {
        const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
        throw new CameraError(denied ? "denied" : "unsupported", error);
    }
    const video = document.createElement("video");
    video.className = "camera-feed";
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("aria-hidden", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    document.body.appendChild(video);
    await new Promise((resolve) =>
    {
        if (video.readyState >= 2)
        {
            resolve();
        }
        else
        {
            video.onloadeddata = () => resolve();
        }
    });
    await video.play().catch(() => null);
    source =
    {
        element: video,
        stream,
        get width()
        {
            return video.videoWidth || 640;
        },
        get height()
        {
            return video.videoHeight || 480;
        },
        isVideo: true
    };
    return source;
}

export function closeCamera()
{
    if (source && source.stream)
    {
        for (const track of source.stream.getTracks())
        {
            track.stop();
        }
    }
    if (source && source.stop)
    {
        source.stop();
    }
    if (source && source.isVideo)
    {
        source.element.srcObject = null;
        source.element.remove();
    }
    source = null;
}

export function startFrameLoop(onFrame)
{
    let running = true;
    let lastVideoTime = -1;
    const element = source ? source.element : null;
    const useVideoCallback = element && source.isVideo && typeof element.requestVideoFrameCallback === "function";
    const step = () =>
    {
        if (!running || !source)
        {
            return;
        }
        const now = performance.now();
        const time = source.isVideo ? source.element.currentTime : now;
        if (time !== lastVideoTime)
        {
            lastVideoTime = time;
            onFrame(now);
        }
        schedule();
    };
    const schedule = () =>
    {
        if (useVideoCallback)
        {
            element.requestVideoFrameCallback(step);
        }
        else
        {
            window.requestAnimationFrame(step);
        }
    };
    schedule();
    return () =>
    {
        running = false;
    };
}

export function detectHands(timestamp)
{
    if (!handTracker || !source)
    {
        return null;
    }
    try
    {
        return handTracker.detectForVideo(source.element, timestamp);
    }
    catch (error)
    {
        return null;
    }
}

export function detectFace(timestamp)
{
    if (!faceTracker || !source)
    {
        return null;
    }
    try
    {
        return faceTracker.detectForVideo(source.element, timestamp);
    }
    catch (error)
    {
        return null;
    }
}

export function getSource()
{
    return source;
}
