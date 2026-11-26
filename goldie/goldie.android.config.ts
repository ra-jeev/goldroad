import base from "./goldie.config.ts";

// Google Play phone screenshots: the same scenes, copy and theme as the iPhone set,
// captured on the Pixel 9 Pro AVD "Pixel_9_Pro_goldie" (dark mode) and framed with the Pixel bezel.
// Build the demo APK first (it plays the Day #100 boards, like iOS ScreenshotMode):
//   cd /Users/rajeev/.codex/worktrees/android/goldroad/mobile/android && ./gradlew :app:assembleProductionScreenshot
// Then: GOLDIE_CONFIG=$PWD/goldie/goldie.android.config.ts npx -y goldie@0 capture && ... frame && ... manifest
export default {
  ...base,
  devices: ["pixel-10-pro"],
  android: {
    appPath:
      "/Users/rajeev/.codex/worktrees/android/goldroad/mobile/android/app/build/outputs/apk/production/screenshot/app-production-screenshot.apk",
    applicationId: "com.playgoldroad.android.shots",
  },
  scenes: base.scenes
    .filter((scene) => scene.kind === "screenshot")
    .map((scene) => ({ ...scene, flow: scene.flow.replace("store-", "store-android-") })),
};
