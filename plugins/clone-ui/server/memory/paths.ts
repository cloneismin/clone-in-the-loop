import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const GBRAIN_REVISION = "1ec6a6e842a15f2bde2ebe8c3a686a6fa6b17aa5";
export const GBRAIN_VERSION = "0.45.9.0";
export const GBRAIN_DIRECTORY = resolve(REPOSITORY_ROOT, ".clone-loop/deps/gbrain");
