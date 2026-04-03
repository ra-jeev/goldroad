-- Local development seed data for GoldRoad API testing.
-- This script is idempotent for the core demo rows.

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
  '{"rows":6,"cols":6,"tiles":[1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6],"blocked":[{"from":8,"to":9},{"from":9,"to":10},{"from":10,"to":11}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":14,"end":35}',
  '[14,15,16,22,28,34,35]',
  27,
  126,
  'easy',
  5,
  3,
  1,
  0,
  '2026-01-01T00:00:00.000Z',
  NULL
),
(
  2,
  '{"rows":6,"cols":6,"tiles":[6,5,4,3,2,1,6,5,4,3,2,1,6,5,4,3,2,1,6,5,4,3,2,1,6,5,4,3,2,1,6,5,4,3,2,1],"blocked":[{"from":2,"to":3},{"from":20,"to":21}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":13,"end":30}',
  '[13,14,15,21,27,33,32,31,30]',
  31,
  126,
  'medium',
  8,
  4,
  1,
  0,
  '2026-01-02T00:00:00.000Z',
  NULL
),
(
  3,
  '{"rows":6,"cols":6,"tiles":[3,3,3,3,3,3,2,2,2,2,2,2,4,4,4,4,4,4,5,5,5,5,5,5,1,1,1,1,1,1,6,6,6,6,6,6],"blocked":[{"from":6,"to":7},{"from":7,"to":8}],"cost":[],"bonus":[],"costValue":1,"bonusValue":1,"start":12,"end":35}',
  '[12,13,14,15,16,17,23,29,35]',
  39,
  126,
  'hard',
  3,
  7,
  1,
  1,
  '2026-01-03T00:00:00.000Z',
  '2026-01-04T00:00:00.000Z'
);
