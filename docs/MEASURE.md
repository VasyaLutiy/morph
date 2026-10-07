# Замеры по фазам

Строка на фазу; метрики — `docs/PLAN.md`, раздел «Замеры по ходу».

| фаза | строитель | карт план/принято/сгорело | $ исп. / $ оркестр. | минуты | tsc-first-red | neighbour-red | дефекты судьи | заглушки судьи | строк руками | hazards | макс. срез, байт |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | mrph | 1 / 1 / 4 | 0.0343 / — | 3 | 3 из 4 | 0 | — | — | 766 | 0 | 12383 |
| P1 | mrph | 8 / 6 / 8 | 0.1438 / — | 13 | 2 из 8 | 0 | 5 | 1 | — | 0 | 48943 |
| P1b | mrph | 2 / 2 / 1 | 0.0270 / — | 2 | 0 из 1 | 0 | 1 | 0 | 10 | 0 | 57059 |
| P2 | mrph | 8 / 8 / 5 | 0.1087 / — | 6 | 1 из 5 | 0 | 0 | 0 | — | 0 | 59622 |
| P3 | mrph | 8 / 8 / 16 (2 runs: 1+8 written) | 0.2254 / opus55 ≈137k/66/47 (run agent; prep on the laptop) | 42 | 0 из 16 | 0 | 1 (diff hunk start) | 0 | — | 0 | 60876 |
| P4 | mrph | 8 / 8 / 13 (2 runs: 7+1 written; re-cut 1 card) | 0.1406 / opus55 ≈120k/45/32 (run agent) | 17 | 5 из 13 | 0 | 0 | 0 | — | 0 | 59990 |
| P5 | mrph | 8 / 7 / 20 (3 runs: 7+0+0 written; re-cut 1 card, failed again; debt run at max_tokens 25500 failed — debt open: generation judge) | 0.2787 (incl. debt run 0.0952) / opus48 prep 261k/76/33 + run ≈160k/30/45 + opus55 debt ≈90k/35/40 | 44 | 2 из 17 | 0 | 0 | 0 | — | 0 | 56357 |
| P5 debt (fable) | claude -p | 1 / 1 / 0 (process-generation-judge, processor swap: Fable 5.1 xhigh; 14 tests, 1 acceptance run, 0 defects, 2/2 mutations killed; closes #2) | 4.1723 (Fable, subscription list price) / — | 7 | — | 0 | 0 | 0 | — | 0 | — |
| P6 | mrph | 8 / 8 / 6 (1 run, no re-cut) | 0.0984 / opus55 prep ≈226k/70/22 + run ≈100k/20/30 | 18 | 1 из 6 | 0 | 0 | 0 | — | 0 | 38522 |
| P7 | mrph | 10 / 10 / 6 (1 run, no re-cut) | 0.1276 / opus55 prep 252k/68/23 + run ≈110k/40/30 | 17 | 0 из 6 | 0 | 0 | 0 | — | 0 | 66256 |
| P7 smoke | V2 binary (`dist/cli.js run`, glm53 z-ai/glm-5.3 via OpenRouter, Novita) | 3 / 3 / 0 (exit 0, 2 generations, 3 requests, 355 in / 106 out tokens) | 0.0003 (usageTotals.cost 0.00028902) / opus55 smoke ≈90k | 0.2 (10 s) | — | 0 | — | — | 0 | 0 errors, 2 implicit-read warnings | 0 |
| P8 | mrph | 8 / 8 / 6 (1 run, no re-cut) | 0.0456 / opus55 prep 227k/63/36 + run ≈95k/30/12 | 5 | 2 из 6 | 0 | 0 | 0 | — | 0 | 46386 |
| P9 | mrph | 8 / 8 / 12 (1 run, no re-cut) | 0.1556 / opus55 prep 270k/85/29 + run ≈110k/30/17 | 12 | 0 из 12 | 0 | 0 | 0 | — | 0 | 66539 |
| P9b | mrph | 9 / 9 / 8 (2 runs: 8+1 written; re-cut 1 card — data, output-directive-judge, TASK §2.2 wording) | 0.0944 (run 1 0.0860 + run 2 0.0084) / opus55 run ≈95k/40/20 | 7 | 0 из 8 | 0 | 0 | 0 | — | 0 | 51114 |
| P9c | mrph | 7 / 7 / 5 (1 run, no fix; burned: 2 unclosed fences, 1 missing files, 2 losing variants) | 0.0873 / opus55 run ≈60k/10/12 | 4 | 0 из 5 | 0 | 0 | 0 | — | 0 | 48989 |
| P9 switch test | V2 replay ×3 + mrph control | 8 / 0, 0, 7 (V2 before P9b, after P9b, after P9c) · mrph control 5 | 0.0750 + 0.0899 + 0.0957 (V2) + 0.1613 (mrph control) = 0.4219 / main session | 6 + 9 + 6 + 15 | — | — | — | — | — | 0 | 61000 |
| P10a | **V2 binary** (deck cut by mrph, `v2deck.py`; `--max-retry-batches 8`) | 12 / 12 / 27 (4 runs: 0 + 10 + 1 + 1 written; 3 data fixes, the third an operator exception after an emergency stop) | 0.3718 (0.0542 + 0.2407 + 0.0505 + 0.0264) / opus55 prep + main session run | 17 | 2 of 27 | 0 | 4 (judge own tests guessing; skeleton constants unused) | 0 | — | 0 | 73936 |
| P10b1 | **V2 cut + V2 run** (`morph plan` → `morph run`, `--max-retry-batches 8`) | 10 / 10 / 8 (1 run, no fix; 4 retries won: probe-dir-judge r1, build-acceptances r1; 4 losing variants) | 0.0998 / opus55 prep + main session run | 8 | — | 0 | 0 | 0 | — | 0 | 43400 |

P7 smoke stdout (exit 0; deck and recipe in `decks/p7/smoke/`, no secret in it): `{"runId":"20261006-192809","branch":"morph/20261006-192809","base":"f3bd88ae78dcbd13324b9745bb0dc66a1a154ab3","report":{"runId":"20261006-192809","completedAt":1791314899462,"branch":"morph/20261006-192809","processor":"glm53","generations":2,"outcomes":[{"customId":"a","status":"written","reason":null,"attempts":1,"winningVariant":"a.v1","acceptanceLog":"a ok\n","earlierFailures":[],"commit":"9ccfd37c1ea669c7af51d95db6dd52ccc68eeeb7","diffstat":{"files":1,"insertions":3,"deletions":0}},{"customId":"b","status":"written","reason":null,"attempts":1,"winningVariant":"b.v1","acceptanceLog":"b ok\n","earlierFailures":[],"commit":"41836124e3fde2d9892baadddfd1373c86017bb0","diffstat":{"files":1,"insertions":3,"deletions":0}},{"customId":"c","status":"written","reason":null,"attempts":1,"winningVariant":"c.v1","acceptanceLog":"c ok\n","earlierFailures":[],"commit":"801f5018927ed96f568f3ea18a328e7da2f0c68f","diffstat":{"files":1,"insertions":6,"deletions":0}}],"usageTotals":{"inputTokens":355,"outputTokens":106,"cost":0.00028901999999999997,"requests":3}},"archive":{"ok":true,"dir":".morph/runs/20261006-192809","commit":"f1a81c18d63110e181e4e293af5360a9ce485b3a"}}`

## Сравнение оркестраторов на подготовке P3 (06.10, одинаковый бриф, свои worktree, без прогона)

| модель | примеров в записи | Component, байт | карт / поколений | макс. срез, байт | токены агента | вызовы | минуты | $ сессии (Usage) | ветка |
|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5 | 11 | 7 044 | 8 / 4 | 21 159 | 256 274 | 130 | 27 | ≤ 7.96 (вместе с прогоном P2) | p3/sonnet5 |
| Opus 4.8 | 10 | 6 806 | 8 / 4 | 34 103 | 247 229 | 94 | 34 | 16.98 | p3/opus48 |
| Opus 5.5 | 14 | 10 494 | 8 / 4 | 43 862 | 213 655 | 104 | 19 | 6.26 | p3/opus55 → main |

Качество: Opus 5.5 — лимит лога 4000 соблюдён ровно и зафиксирован фикстурой, свой дифф с cap 6000,
пример сироты различает убийство группы (208 мс) и оболочки (3 с), запрет `process.env` в страже;
Sonnet 5 — дифф внешним `diff -u`, сирота через `ps`, лимит 4000 превышен (4 062), судьи на сухом
прогоне красны на eslint, а не на страже; Opus 4.8 — проба в срезе судьи (судья копирует пробу
вместо тестов из примеров), лимит 4000 превышен. Никто не поправил Requirement Deterministic Core
(называл acceptance) — поправлено рукой в выбранной ветке. Доллары — из Usage сессии оператора 06.10 15:22 (вся сессия $83.92, из них Fable $52.71 за
оркестрацию P0–P2 и диалог). Opus 5.5 — самый дешёвый в долларах при самой сильной колоде. Выбор оператора: Opus 5.5 в прогон;
в авторежиме основной оркестратор Opus 5.5, запасной Opus 4.8.

## Autonomous stretch

Running total of the autonomous stretch: $2.1474 of $30 (P3 $0.2254 + P4 $0.1406 + P5 $0.2787 incl. debt run $0.0952 + P6 $0.0984 + P7 $0.1276 + P7 smoke $0.0003 + P8 $0.0456 + P9 $0.1556 + P9b $0.0944 + P9c $0.0873 + P9 switch test $0.4219 + P10a $0.3718 + P10b1 $0.0998).
