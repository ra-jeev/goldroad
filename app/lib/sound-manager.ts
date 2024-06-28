import { Howl } from 'howler';

const gameSounds = {
  coin: '/audio/coin.mp3',
  deny: '/audio/deny.mp3',
  noMoves: '/audio/no-moves.mp3',
  win: '/audio/win.mp3',
  okay: '/audio/okay.mp3',
};

type SoundName = keyof typeof gameSounds;

class SoundManager {
  private sounds: { [key in SoundName]?: Howl } = {};

  constructor() {
    this.loadSounds();
  }

  private loadSounds() {
    for (const [key, src] of Object.entries(gameSounds)) {
      this.sounds[key as SoundName] = new Howl({
        src: [src],
      });
    }
  }

  play(soundName: SoundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.play();
    } else {
      console.warn(`Sound ${soundName} not found!`);
    }
  }
}

const soundManager = new SoundManager();

export default soundManager;
