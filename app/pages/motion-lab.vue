<script setup lang="ts">
/**
 * TEMPORARY. Every piece of board motion on one page, replayable on demand,
 * using the real components so what plays here is what plays in the game.
 * Sheet entrances are deliberately absent — they are their own surface.
 * Delete this page once the motion set is settled.
 */
const stepKey = ref(0);
const shakeKey = ref(0);
const roadKey = ref(0);
const hintKey = ref(0);
const pulseType = ref<'toll' | 'bonus'>('bonus');
const pulseKey = ref(0);
const failKey = ref(0);
const nudgeKey = ref(0);
const spinning = ref(false);

const ROAD_DIRECTIONS = [
  { dir: 'right', orientation: 'h' as const, label: 'Walked right' },
  { dir: 'left', orientation: 'h' as const, label: 'Walked left' },
  { dir: 'down', orientation: 'v' as const, label: 'Walked down' },
  { dir: 'up', orientation: 'v' as const, label: 'Walked up' },
];

// The guide route the hint reveal walks through, longest case.
const HINT_ROUTE = [4, 2, 6, 3];

function pulse(type: 'toll' | 'bonus') {
  pulseType.value = type;
  pulseKey.value += 1;
}

function playAll() {
  stepKey.value += 1;
  shakeKey.value += 1;
  roadKey.value += 1;
  hintKey.value += 1;
  failKey.value += 1;
  nudgeKey.value += 1;
  pulse(pulseType.value === 'bonus' ? 'toll' : 'bonus');
}

const reducedMotion = ref(false);
onMounted(() => {
  reducedMotion.value = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
});

useHead({ title: 'Motion lab' });
</script>

<template>
  <div class="lab">
    <header class="lab-head">
      <p class="eyebrow">Motion lab</p>
      <h1>Every animation, on demand</h1>
      <p class="lab-lead">
        Real components, real CSS. Press a card's replay to run it again, or
        <button type="button" class="inline-play" @click="playAll">
          play everything at once
        </button>.
      </p>
      <p v-if="reducedMotion" class="lab-warning">
        This browser asks for reduced motion, so every duration here collapses
        to nothing. That is the app behaving correctly, not the lab failing.
      </p>
    </header>

    <section class="card">
      <div class="card-head">
        <h2>The step</h2>
        <button type="button" class="replay" @click="stepKey += 1">
          Replay
        </button>
      </div>
      <p class="card-note">
        Fires on the tile you arrive at, every move. 190ms, scale to 1.07.
      </p>
      <div class="stage">
        <GameTile
          :key="`step-${stepKey}`"
          :value="6"
          :is-start="false"
          :is-end="false"
          :is-current="true"
          :is-active="false"
          :is-done="true"
          :is-hinted="false"
          :tab-index="-1"
          disabled
        />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>The road</h2>
        <button type="button" class="replay" @click="roadKey += 1">
          Replay
        </button>
      </div>
      <p class="card-note">
        The glyph clips from nothing to full length in the direction you
        walked, so the arrow is revealed by the stroke rather than flying
        ahead of it. 170ms.
      </p>
      <div class="stage stage--roads">
        <div v-for="road in ROAD_DIRECTIONS" :key="road.dir" class="road-demo">
          <span class="road-demo__label">{{ road.label }}</span>
          <span :class="['road-demo__track', `road-demo__track--${road.orientation}`]">
            <!-- Key the glyph, not the wrapper: replacing the component is
                 what restarts a CSS animation that runs on mount. -->
            <RoadGlyph
              :key="`${road.dir}-${roadKey}`"
              type="open"
              state="traversed"
              :traversed="true"
              :arrow-dir="road.dir"
              :orientation="road.orientation"
            />
          </span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Dead end, then retry</h2>
        <button type="button" class="replay" @click="shakeKey += 1; failKey += 1">
          Replay
        </button>
      </div>
      <p class="card-note">
        The tile the run died on shakes for 220ms; the retry button starts its
        bloom 140ms in, so the eye is walked from the board to the action.
      </p>
      <div class="stage stage--fail">
        <GameTile
          :key="`shake-${shakeKey}`"
          :value="3"
          :is-start="false"
          :is-end="false"
          :is-current="true"
          :is-active="false"
          :is-done="true"
          :is-hinted="false"
          :is-shaking="true"
          :tab-index="-1"
          disabled
        />
        <GameBoardFooter
          :key="`fail-${failKey}`"
          status="Dead end. Walk it again to find the way through."
          :hint-message="null"
          :attempt-number="2"
          :has-moved="true"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          :expedition-just-unlocked="false"
          :hints-used="0"
          :ended="true"
          :solved="false"
          :can-retry="true"
          :can-switch-to-expedition="false"
          :loading="false"
          :submitting="false"
        />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Hint reveal</h2>
        <button type="button" class="replay" @click="hintKey += 1">
          Replay
        </button>
      </div>
      <p class="card-note">
        Guide tiles light rather than appear, 45ms apart along the route. Today
        a hint reveals one tile, occasionally two, so the stagger only shows
        itself if hints ever light a longer stretch — this is four.
      </p>
      <div class="stage">
        <GameTile
          v-for="(value, index) in HINT_ROUTE"
          :key="`hint-${hintKey}-${index}`"
          :value="value"
          :is-start="false"
          :is-end="false"
          :is-current="false"
          :is-active="false"
          :is-done="false"
          :is-hinted="true"
          :hint-delay-ms="index * 45"
          :tab-index="-1"
          disabled
        />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Hint nudge</h2>
        <button type="button" class="replay" @click="nudgeKey += 1">
          Replay
        </button>
      </div>
      <p class="card-note">
        The bulb comes on and settles back, 1s. In the game this fires at the
        top of a third run, and again on a sixth or after five minutes of
        active play — never if a hint has already been used on that road.
      </p>
      <div class="stage">
        <GameBoardFooter
          status="2nd Try"
          :hint-message="null"
          :attempt-number="2"
          :has-moved="false"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          :expedition-just-unlocked="false"
          :hints-used="0"
          :hints-remaining="5"
          :hint-nudge-signal="nudgeKey"
          :ended="false"
          :solved="false"
          :can-retry="false"
          :can-switch-to-expedition="false"
          :loading="false"
          :submitting="false"
        />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Score pulse</h2>
        <div class="card-actions">
          <button type="button" class="replay" @click="pulse('toll')">
            Toll
          </button>
          <button type="button" class="replay" @click="pulse('bonus')">
            Bonus
          </button>
        </div>
      </div>
      <p class="card-note">
        Already shipped, and the piece the rest was built to match: the score
        jumps in the hue of the lane just crossed, 700ms.
      </p>
      <div class="stage stage--wide">
        <GameBoardHeader
          selected-mode="expedition"
          :has-expedition="true"
          :is-expedition-unlocked="true"
          :classic-solved="false"
          :classic-medal="null"
          :expedition-solved="false"
          :expedition-medal="null"
          :score="pulseType === 'bonus' ? 46 : 38"
          :max-score="128"
          :total-coins="141"
          :pulse="{ type: pulseType, key: pulseKey }"
        />
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Hint pending</h2>
        <button type="button" class="replay" @click="spinning = !spinning">
          {{ spinning ? 'Stop' : 'Start' }}
        </button>
      </div>
      <p class="card-note">
        Already shipped. The only looping animation in the app, and it stops
        the moment the hint lands.
      </p>
      <div class="stage">
        <GameBoardFooter
          status="1st Try"
          :hint-message="null"
          :attempt-number="1"
          :has-moved="false"
          :show-next-reset-countdown="false"
          :show-stats-link="false"
          :expedition-just-unlocked="false"
          :hints-used="0"
          :hints-remaining="5"
          :hint-pending="spinning"
          :ended="false"
          :solved="false"
          :can-retry="false"
          :can-switch-to-expedition="false"
          :loading="false"
          :submitting="false"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.lab {
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  display: grid;
  gap: 1.1rem;
}

.lab-head h1 {
  margin: 0.25rem 0 0.5rem;
  color: var(--color-gold-bright);
}

.lab-lead,
.lab-warning {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.72);
  line-height: var(--line-height-base);
}

.lab-warning {
  margin-top: 0.6rem;
  color: var(--color-toll-bright);
}

.eyebrow {
  margin: 0;
  color: rgb(var(--color-gold-rgb) / 0.6);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.card {
  display: grid;
  gap: 0.6rem;
  padding: 1.1rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-gold-rgb) / 0.16);
  background: var(--gradient-card-overlay);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-head h2 {
  margin: 0;
  color: var(--color-gold-bright);
  font-size: var(--font-size-xl);
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.card-note {
  margin: 0;
  max-width: 54ch;
  color: rgb(var(--color-gold-rgb) / 0.72);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-base);
}

.replay,
.inline-play {
  border: 1px solid rgb(var(--color-gold-rgb) / 0.28);
  border-radius: var(--radius-full);
  padding: 0.35rem 0.8rem;
  background: rgb(var(--color-gold-rgb) / 0.08);
  color: var(--color-gold);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: 800;
  cursor: pointer;
}

.inline-play {
  padding: 0.1rem 0.5rem;
}

.replay:hover,
.inline-play:hover {
  color: var(--color-gold-bright);
}

.stage {
  display: flex;
  align-items: center;
  gap: var(--tile-gap);
  flex-wrap: wrap;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: rgb(0 0 0 / 0.28);
}

.stage :deep(.tile) {
  width: var(--tile-size);
  height: var(--tile-size);
  flex: 0 0 auto;
}

.stage--fail,
.stage--wide {
  display: grid;
  justify-items: center;
  gap: 1rem;
}

.stage--roads {
  gap: 1.5rem;
}

.road-demo {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
}

.road-demo__label {
  color: rgb(var(--color-gold-rgb) / 0.6);
  font-size: var(--font-size-caption);
}

.road-demo__track {
  position: relative;
  display: block;
}

.road-demo__track--h {
  width: 3.5rem;
  height: var(--road-thickness);
}

.road-demo__track--v {
  width: var(--road-thickness);
  height: 3.5rem;
}
</style>
