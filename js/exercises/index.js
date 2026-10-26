import { walking } from "./walking.js";
import { voice } from "./voice.js";
import { big } from "./big.js";
import { tapping } from "./tapping.js";
import { writing } from "./writing.js";
import { face } from "./face.js";

export const EXERCISES = [walking, big, tapping, writing, voice, face];

export const EXERCISE_GROUPS =
[
    { titleKey: "ex.group.body", ids: ["walking", "big"] },
    { titleKey: "ex.group.hands", ids: ["tapping", "writing"] },
    { titleKey: "ex.group.voice", ids: ["voice", "face"] }
];
