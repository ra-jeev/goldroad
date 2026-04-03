-- Local development seed data for GoldRoad API testing.
-- Generated from the current puzzle generator to keep maxScore/path consistent.

DELETE FROM player_game_session;
DELETE FROM daily_game_stats;
DELETE FROM games;

INSERT INTO games (
  game_no,
  board_json,
  optimal_path_json,
  max_score,
  total_coins,
  difficulty_band,
  route_count,
  gold_silver_gap,
  active,
  current,
  playable_at,
  next_game_at
) VALUES
(
  1,
  '{"rows":6,"cols":6,"tiles":[6,5,6,6,6,6,3,2,2,1,6,6,1,2,4,3,3,2,2,2,6,1,3,1,6,1,3,4,3,2,3,6,4,4,3,1],"blocked":[{"from":19,"to":20},{"from":19,"to":25},{"from":8,"to":9},{"from":26,"to":32},{"from":24,"to":25},{"from":28,"to":29},{"from":7,"to":13},{"from":3,"to":9},{"from":10,"to":11},{"from":25,"to":31}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":15,"end":5}',
  '[15,21,20,26,27,33,32,31,30,24,18,19,13,14,8,7,6,0,1,2,3,4,10,16,22,28,34,35,29,23,17,11,5]',
  122,
  125,
  'easy',
  3748,
  0,
  1,
  0,
  '2026-01-01T00:00:00.000Z',
  NULL
),
(
  2,
  '{"rows":6,"cols":6,"tiles":[2,4,1,6,3,1,2,3,4,4,3,6,2,4,4,4,3,3,6,5,5,3,1,6,2,2,5,5,2,6,2,4,4,6,2,5],"blocked":[{"from":23,"to":29},{"from":27,"to":28},{"from":25,"to":31},{"from":6,"to":12},{"from":14,"to":20},{"from":16,"to":17},{"from":5,"to":11},{"from":33,"to":34},{"from":24,"to":30},{"from":19,"to":20}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":21,"end":35}',
  '[21,27,33,32,26,25,19,18,12,13,7,6,0,1,2,8,14,15,9,3,4,10,11,17,23,22,28,29,35]',
  111,
  130,
  'easy',
  2562,
  0,
  1,
  0,
  '2026-01-02T00:00:00.000Z',
  NULL
),
(
  3,
  '{"rows":6,"cols":6,"tiles":[3,3,2,2,4,3,3,6,3,1,2,3,4,1,1,5,1,1,2,5,3,6,5,1,5,1,1,1,2,2,3,6,4,1,3,4],"blocked":[{"from":10,"to":11},{"from":8,"to":14},{"from":1,"to":2},{"from":7,"to":13},{"from":26,"to":27},{"from":16,"to":22},{"from":15,"to":21},{"from":15,"to":16},{"from":28,"to":34},{"from":11,"to":17}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":25,"end":35}',
  '[25,19,13,14,15,9,10,4,3,2,8,7,1,0,6,12,18,24,30,31,32,26,20,21,22,23,29,28,27,33,34,35]',
  95,
  103,
  'easy',
  4287,
  0,
  1,
  1,
  '2026-01-03T00:00:00.000Z',
  '2026-01-04T00:00:00.000Z'
);
