import base from "./goldie.config.ts";

// Render config for the preview video only. `goldie capture` (with goldie.config.ts)
// records every segment; this config leaves out the "fast" clip, so the video
// jumps from the first moves to the last ones. Run:
//   GOLDIE_CONFIG=$PWD/goldie/goldie.preview.config.ts npx -y goldie@0 preview
export default {
  ...base,
  scenes: base.scenes.map((scene) =>
    scene.kind === "preview"
      ? { ...scene, segments: scene.segments.filter((segment) => segment.id !== "fast") }
      : scene,
  ),
};
