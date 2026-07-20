import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_RATE = 44_100;
const OUTPUT_DIR = join(process.cwd(), 'sound-candidates');

function createBuffer(durationSeconds) {
  return new Float64Array(Math.ceil(durationSeconds * SAMPLE_RATE));
}

function addGlidingTone(
  output,
  {
    start = 0,
    duration,
    from,
    to = from,
    gain,
    attack = 0.004,
    decay = 5,
    phase = 0,
  },
) {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let angle = phase;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const frequency = from * Math.pow(to / from, progress);
    angle += (Math.PI * 2 * frequency) / SAMPLE_RATE;

    const elapsed = index / SAMPLE_RATE;
    const attackEnvelope = Math.min(1, elapsed / attack);
    const decayEnvelope = Math.exp(-decay * progress);
    const releaseEnvelope = Math.min(1, (1 - progress) / 0.12);
    const outputIndex = startSample + index;

    if (outputIndex < output.length) {
      output[outputIndex] +=
        Math.sin(angle) *
        gain *
        attackEnvelope *
        decayEnvelope *
        releaseEnvelope;
    }
  }
}

function addBell(
  output,
  { start, frequency, duration, gain, downwardDrift = 0.985 },
) {
  const partials = [
    { ratio: 1, gain: 1, decay: 4.2 },
    { ratio: 2.01, gain: 0.34, decay: 6.2 },
    { ratio: 2.72, gain: 0.2, decay: 8.5 },
    { ratio: 4.08, gain: 0.1, decay: 11 },
  ];

  for (const partial of partials) {
    addGlidingTone(output, {
      start,
      duration,
      from: frequency * partial.ratio,
      to: frequency * partial.ratio * downwardDrift,
      gain: gain * partial.gain,
      attack: 0.0025,
      decay: partial.decay,
      phase: partial.ratio,
    });
  }
}

function addNoiseImpact(
  output,
  { start = 0, duration, gain, filter = 0.18, seed = 1 },
) {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let randomState = seed >>> 0;
  let smoothed = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    const noise = (randomState / 0xffffffff) * 2 - 1;
    smoothed += filter * (noise - smoothed);

    const progress = index / sampleCount;
    const envelope = Math.exp(-7 * progress) * Math.sin(Math.PI * progress);
    const outputIndex = startSample + index;

    if (outputIndex < output.length) {
      output[outputIndex] += smoothed * gain * envelope;
    }
  }
}

function addAirTail(
  output,
  { start, duration, gain, seed = 7 },
) {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let randomState = seed >>> 0;
  let slowNoise = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    randomState = (1103515245 * randomState + 12345) >>> 0;
    const noise = (randomState / 0xffffffff) * 2 - 1;
    slowNoise += 0.035 * (noise - slowNoise);

    const progress = index / sampleCount;
    const envelope =
      Math.sin(Math.PI * Math.min(1, progress * 1.5)) *
      Math.pow(1 - progress, 1.7);
    const outputIndex = startSample + index;

    if (outputIndex < output.length) {
      output[outputIndex] += slowNoise * gain * envelope;
    }
  }
}

function finish(output, targetPeak = 0.74) {
  const fadeSamples = Math.floor(SAMPLE_RATE * 0.025);

  for (let index = 0; index < fadeSamples; index += 1) {
    output[output.length - 1 - index] *= index / fadeSamples;
  }

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));

  const scale = targetPeak / Math.max(peak, 0.0001);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.tanh(output[index] * scale * 1.15) / 1.15;
  }

  return output;
}

function writeMonoWav(path, samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    wav.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }

  writeFileSync(path, wav);
}

function synthesizeDeny() {
  const output = createBuffer(0.3);

  // A boot meeting a gilded barrier: tactile first, metallic second.
  addNoiseImpact(output, {
    duration: 0.055,
    gain: 0.22,
    filter: 0.12,
    seed: 41,
  });
  addGlidingTone(output, {
    duration: 0.14,
    from: 132,
    to: 82,
    gain: 0.34,
    decay: 7.5,
  });
  addBell(output, {
    start: 0.012,
    frequency: 659.25,
    duration: 0.22,
    gain: 0.25,
    downwardDrift: 0.94,
  });
  addBell(output, {
    start: 0.07,
    frequency: 554.37,
    duration: 0.19,
    gain: 0.14,
    downwardDrift: 0.96,
  });

  return finish(output, 0.7);
}

function synthesizeDeadEnd() {
  const output = createBuffer(1.05);

  // A weighty stop followed by a descending lantern-like gold resonance.
  addNoiseImpact(output, {
    duration: 0.1,
    gain: 0.25,
    filter: 0.08,
    seed: 97,
  });
  addGlidingTone(output, {
    duration: 0.3,
    from: 105,
    to: 58,
    gain: 0.4,
    decay: 6.5,
  });
  addBell(output, {
    start: 0.018,
    frequency: 523.25,
    duration: 0.58,
    gain: 0.27,
    downwardDrift: 0.975,
  });
  addBell(output, {
    start: 0.2,
    frequency: 392,
    duration: 0.68,
    gain: 0.23,
    downwardDrift: 0.965,
  });
  addBell(output, {
    start: 0.43,
    frequency: 293.66,
    duration: 0.52,
    gain: 0.12,
    downwardDrift: 0.95,
  });
  addAirTail(output, {
    start: 0.12,
    duration: 0.88,
    gain: 0.12,
    seed: 313,
  });

  return finish(output, 0.72);
}

function render(name, samples) {
  const wavPath = join(OUTPUT_DIR, `${name}.wav`);
  const mp3Path = join(OUTPUT_DIR, `${name}.mp3`);

  writeMonoWav(wavPath, samples);
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      wavPath,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '128k',
      mp3Path,
    ],
    { stdio: 'inherit' },
  );
  unlinkSync(wavPath);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
render('deny-gilded-barrier', synthesizeDeny());
render('deadend-lantern-dim', synthesizeDeadEnd());
