// Inline launch screen. Plain DOM, no Vue, so it paints fast in the feed.
// It renders from postData only: no server call before the first paint.
import { context, requestExpandedMode } from '@devvit/web/client';
import type { RoadPostData } from '../shared/api';
import './tokens.css';
import './splash.css';

const data = context.postData as RoadPostData | undefined;

if (data) {
  const label = document.getElementById('road-label');
  const target = document.getElementById('target');
  const line = document.getElementById('line');
  const board = document.getElementById('mini-board');
  if (label) label.textContent = `GoldRoad #${data.roadNo}`;
  if (target) target.textContent = `Target ${data.target}`;
  if (line) line.textContent = `Walk from the start to the flag. Land exactly on ${data.target}.`;
  if (board) {
    board.style.gridTemplateColumns = `repeat(${data.cols}, auto)`;
    data.tiles.forEach((value, id) => {
      const tile = document.createElement('span');
      tile.className = 'mini-tile';
      if (id === data.start) tile.classList.add('start');
      if (id === data.end) tile.classList.add('end');
      tile.textContent = String(value);
      board.append(tile);
    });
  }
}

// requestExpandedMode must run synchronously inside the trusted click.
document.getElementById('play-btn')?.addEventListener('click', (event) => {
  requestExpandedMode(event, 'play');
});
