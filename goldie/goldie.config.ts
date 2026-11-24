import type { GoldieConfig } from "/Users/rajeev/.npm/_npx/18a971dee120d222/node_modules/goldie/dist/config.d.ts";

const APP_ROOT = "/Users/rajeev/Developer/den/goldroad";

// Captures run in the app's screenshot mode (mobile/ios/GoldRoad/ScreenshotMode.swift):
// before capturing, create the marker file on the simulator device:
//   touch "$(xcrun simctl getenv <udid> SIMULATOR_SHARED_RESOURCES_DIRECTORY)/GoldRoadScreenshotMode"
// The app then plays a local demo road (the Day #100 boards) with a sample
// history, so every capture looks the same on any day. Delete the file after.
const t = (en: string) => ({ "en-US": en });

const config: GoldieConfig = {
  appRoot: APP_ROOT,
  // Build (ad-hoc signed): xcodebuild -project mobile/ios/GoldRoad.xcodeproj -scheme GoldRoad
  //   -configuration Release -sdk iphonesimulator -derivedDataPath /tmp/claude-501/gr-release
  //   CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= build
  appPath: "/tmp/claude-501/gr-release/Build/Products/Release-iphonesimulator/GoldRoad.app",
  bundleId: "com.playgoldroad.ios",
  devices: ["iphone-6.9"],
  locales: ["en-US"],
  appearance: "dark",

  frame: { variant: "17-pro-orange" },

  theme: {
    background:
      "linear-gradient(170deg, #6E4C12 0%, #3A2608 34%, #1A1004 68%, #0D0702 100%)",
    headlineColor: "#F6D27A",
    subheadColor: "#CDB487",
    fontFiles: [
      { family: "Marcellus", files: { 400: "../mobile/ios/GoldRoad/Fonts/Marcellus-Regular.ttf" } },
      { family: "Chivo", files: { 700: "../mobile/ios/GoldRoad/Fonts/Chivo-Bold.ttf" } },
    ],
    fontFamily: '"Marcellus", "Chivo", serif',
    copyHeightRatio: 0.24,
    deviceWidthRatio: 0.84,
    template: ["panorama", "hero", "offset", "classic", "tilt"],
    layout: "classic",
  },

  store: {
    name: "GoldRoad: Daily Path Puzzle",
    subtitle: t("Plan a route, hit the number"),
    developer: "Rajeev R Sharma",
    category: "Puzzle",
    rating: 4.8,
    ratingCount: "New",
    ageRating: "4+",
    price: "Free",
    description: t(
      "GoldRoad is a daily number path puzzle. Every day brings one new road.\n\nWalk from your footprints to the finish flag, one tile at a time. Each tile changes your score. The road is solved only when you reach the flag with your score exactly on the target.",
    ),
  },

  scenes: [
    {
      kind: "screenshot",
      id: "route",
      flow: "store-01-route",
      headline: t("Plan a route, hit the number"),
      subhead: t("Walk from the footprints to the flag. Land exactly on the target."),
    },
    {
      kind: "screenshot",
      id: "solved",
      flow: "store-02-solved",
      headline: t("Gold on the first try"),
      subhead: t("Not more, not less. Fewer tries, better medal."),
    },
    {
      kind: "screenshot",
      id: "hint",
      flow: "store-03-hint",
      headline: t("Two roads every day"),
      subhead: t("Expedition adds tolls and bonuses. A hint is always there."),
    },
    {
      kind: "screenshot",
      id: "stats",
      flow: "store-04-stats",
      headline: t("See how the field played"),
      subhead: t("Medals, streaks, and where you stand among other players."),
    },
    {
      kind: "screenshot",
      id: "home",
      flow: "store-05-home",
      headline: t("Keep your streak alive"),
      subhead: t("Two new roads every day. No account, no ads."),
    },
    {
      kind: "preview",
      id: "preview",
      // Story: Home, the first moves, the last moves and the solve, then Stats.
      // "fast" walks the middle of the road and is cut from the video: render
      // with GOLDIE_CONFIG=goldie/goldie.preview.config.ts, which leaves it out.
      segments: [
        { id: "open", flow: "store-preview-01-home" },
        { id: "walk", flow: "store-preview-02-walk" },
        { id: "fast", flow: "store-preview-03-fast" },
        { id: "finish", flow: "store-preview-04-finish" },
        { id: "stats", flow: "store-preview-05-stats", holdSeconds: 1 },
      ],
    },
  ],
};

export default config;
