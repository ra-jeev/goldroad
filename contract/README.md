# GoldRoad cross-platform contract

The TypeScript rules and validators are the source of truth. Clients use the
JSON fixtures to check that they agree on gameplay, API payloads, and copy.

| File | What clients verify |
| --- | --- |
| `constants.json` | Gameplay limits, medal thresholds, and the feedback address and subject |
| `fixtures/rules.json` | Board inputs, moves, and the resulting run state |
| `fixtures/hints.json` and `fixtures/hint-messages.json` | Hint results and player-facing copy |
| `fixtures/medals.json` and `fixtures/share.json` | Medal thresholds and exact share text |
| `fixtures/stats.json` | Personal and community stats |
| `fixtures/rollover.json` | Daily road availability |
| `api/*.schema.json` and `api/samples/*.json` | API shapes and representative payloads |

## Update the contract

Edit the TypeScript source to change a rule, API shape, or share text. Add or
update fixture inputs in `scripts/generate-contract.ts`, then run:

```sh
pnpm contract:generate
pnpm contract:check
```

Commit the generated diff with the TypeScript change. `contract:check`
regenerates into a temporary directory and compares the managed files byte
for byte. The Classic and Expedition boards in the generator are snapshots
from the development seed. The generator needs no network access.

For Android or another client, read the JSON files as test resources. Replay
each rule case from `case.road` when present, or the top-level `road` otherwise.
Treat the input and expected fields in the other fixtures the same way. Decode
the API samples into the production request and response types. The generated
JSON Schemas describe the wire shape. Additional checks such as verifying
adjacent board edges are enforced by the source Zod validators.
