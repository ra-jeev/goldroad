// Inline launch screen. Plain DOM, no Vue, so it paints fast in the feed.
// It renders from postData only: no server call before the first paint.
import { context, requestExpandedMode } from '@devvit/web/client';
import type { RoadPostData } from '../shared/api';
import './tokens.css';
import './splash.css';

// The same start and finish marks as the play board (app/components/GameTile.vue).
const MARK = {
  start: '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M10.496 2.01a1.25 1.25 0 0 1 1.099 1.384l-.072.625a1.25 1.25 0 1 1-2.484-.285l.072-.626a1.25 1.25 0 0 1 1.384-1.099m4.94 2.111a1.72 1.72 0 0 0-1.356-2.015a1.716 1.716 0 0 0-2.011 1.36l-.165.845a1.717 1.717 0 0 0 1.356 2.016c.93.18 1.83-.429 2.011-1.361z"/><path d="M13.66 8.92c0-3-2.46-3.42-5.5-3.42s-5.43.38-5.49 3.31v11.11a4.5 4.5 0 1 0 8.18-2.58a3.59 3.59 0 0 1 .81-4.16a5.49 5.49 0 0 0 2-4.26M8.67 3.43a1.13 1.13 0 0 0-2.26 0V4a1.13 1.13 0 1 0 2.26 0zm-3.798-.57a1.03 1.03 0 0 1 1.136.907l.06.517a1.03 1.03 0 0 1-.902 1.14a1.03 1.03 0 0 1-1.135-.907l-.06-.516a1.03 1.03 0 0 1 .901-1.14"/><path d="m2.67 4.092l-.009.002a.87.87 0 0 0-.64 1.051l.107.437a.87.87 0 0 0 1.051.64l.01-.003a.87.87 0 0 0 .64-1.05l-.107-.438a.87.87 0 0 0-1.051-.64m19.239 5.923a1.25 1.25 0 0 1-1.384-1.1l-.072-.625a1.25 1.25 0 1 1 2.484-.286l.071.626a1.25 1.25 0 0 1-1.099 1.385m-5.122-.146A1.72 1.72 0 0 0 18.8 11.23a1.72 1.72 0 0 0 1.355-2.015l-.164-.844a1.72 1.72 0 0 0-2.011-1.362a1.717 1.717 0 0 0-1.356 2.016z"/><path d="M18.39 13.82c0-3 2.47-3.42 5.5-3.42s5.44.38 5.5 3.31v11.12a4.5 4.5 0 1 1-9 0c0-.926.29-1.828.83-2.58a3.6 3.6 0 0 0-.81-4.16a5.5 5.5 0 0 1-2.02-4.27m5-4.91a1.13 1.13 0 1 0 2.26 0v-.57a1.13 1.13 0 0 0-2.26 0zm3.495 1.402a1.03 1.03 0 0 1-.901-1.14l.06-.517c.064-.565.573-.97 1.135-.906s.966.575.9 1.14l-.059.516a1.027 1.027 0 0 1-1.135.907m1.981.797l.01.002a.87.87 0 0 0 1.051-.64l.107-.437a.87.87 0 0 0-.64-1.05l-.01-.003a.87.87 0 0 0-1.05.64l-.107.437a.87.87 0 0 0 .64 1.05"/></svg>',
  end: '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M105 37v114h30V37zm272 0v114h30V37zM16 48v20.94c20.9 6.4 43.8 13.28 43.8 13.28l-43.8.51V112h71V48zm137 0v64h206V88.53l-26.9-9.7l26.9-4.54V48zm272 0v64h71V48zM73 169v42.5l38.1 9.4l-38.1 8.2v68.5l44.3-3.2l-44.3 29v70c32.2 10 62.4 32.8 92.1 53.2c3.5 2.4 7 4.7 10.5 7l25-25l-9.5 34.9c22.6 13.7 44.5 23.5 64.9 23.5c28.2 0 59.1-18.6 90.9-40.4c29.7-20.4 59.9-43.2 92.1-53.2v-13.9l-66.8-17.1l66.8-12.6V169H306.7L256 202.8L205.3 169z"/></svg>',
};

function marker(kind: keyof typeof MARK): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'mini-mark';
  mark.innerHTML = MARK[kind];
  return mark;
}

const data = context.postData as RoadPostData | undefined;

if (data) {
  const label = document.getElementById('road-label');
  const target = document.getElementById('target');
  const line = document.getElementById('line');
  const board = document.getElementById('mini-board');
  if (label) label.textContent = `GoldRoad #${data.roadNo}`;
  if (target) target.textContent = `Target ${data.target}`;
  if (line) {
    const intro = data.community ? `Community road: ${data.community}. ` : '';
    line.textContent = `${intro}Walk from the start to the flag. Land exactly on ${data.target}.`;
  }
  if (board) {
    board.style.gridTemplateColumns = `repeat(${data.cols}, auto)`;
    data.tiles.forEach((value, id) => {
      const tile = document.createElement('span');
      tile.className = 'mini-tile';
      tile.textContent = String(value);
      if (id === data.start) {
        tile.classList.add('start');
        tile.append(marker('start'));
      }
      if (id === data.end) {
        tile.classList.add('end');
        tile.append(marker('end'));
      }
      board.append(tile);
    });
  }
}

// requestExpandedMode must run synchronously inside the trusted click.
document.getElementById('play-btn')?.addEventListener('click', (event) => {
  requestExpandedMode(event, 'play');
});
