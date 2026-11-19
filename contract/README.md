# GoldRoad cross-platform contract

The TypeScript rules and validators are the source of truth. Clients use the
JSON fixtures to check that they agree on gameplay, API payloads, and copy.

| File | What clients verify |
| --- | --- |
| `constants.json` | Gameplay limits and medal thresholds |
| `fixtures/rules.json` | Board inputs, moves, and the resulting run state |
| `fixtures/hints.json` and `fixtures/hint-messages.json` | Hint results and player-facing copy |
| `fixtures/medals.json` and `fixtures/share.json` | Medal thresholds and exact share text |
| `fixtures/stats.json` | Personal and community stats |
| `fixtures/rollover.json` | Daily road availability |
| `api/*.schema.json` and `api/samples/*.json` | API shapes and representative payloads |
