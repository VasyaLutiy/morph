# MorphV2 — план по эпикам и фазам, стартовая запись (Нулевой Контур)

> План от 06.10.2026, зафиксирован в репозитории MorphV2 первым коммитом. Строится
> **старым Морфом** (`mrph` из `morph-lab/venv`) до P13, далее самим V2.

## Context

Решения оператора 06.10.2026: репозитории `mrph` и `morph-lab` замораживаются (гасится
только README); новый продукт — **MorphV2** в чистом репозитории
`/home/john/Documents/Work2026/MorphV2`, стек TypeScript, основа — проверенный
headless-режим старого Морфа, старый REPL (`flows/morph.py`) не переносится,
MultiLanguage с первого дня. Строится **старым Морфом** (`mrph` из `morph-lab/venv`,
исполнитель glm-5.3 через OpenRouter): запись Contour → `plan --spec --judge` → `run`.

Ответы оператора на вопросы плана:
- Эпики V2: ядро (колода, компилятор, приёмка, цикл поколений, процессор, отчёт)
  **плюс** primer, scout, plan --spec, reviewer.
- Артефакты V2 — **новая схема**, без совместимости со старым `deck.json`/`report.json`.
  Следствие: байтового оракула нет, истина — запись и примеры; старый `mrph` остаётся
  только строителем (его primer/scout/deck check читают дерево V2 во время сборки, потому
  что сборочные артефакты пишет он сам).
- Бинарь CLI — `morph`. Node 20+ LTS, TypeScript strict, vitest, ESLint, npm.
- Потолок исполнителей — **$5 на фазу**, фазы по 6–10 карт.

Мандат оператора: автор плана пишет **Нулевой Контур** — стартовую запись
`contour.yaml` будущего проекта (System, Component, Function с behavior и examples,
Data Object, Requirement, Guardrail) и `morph-map.json` к ней.

Оператор (06.10, во время планирования): «зафиксируй план в
/home/john/Documents/Work2026/MorphV2». Режим плана запрещает писать вне файла плана,
поэтому это **шаг 0 исполнения**: `git init` в `MorphV2/`, первый коммит с
`docs/PLAN.md` (этот план), `contour.yaml` (Нулевой Контур), `morph-map.json`,
`.gitignore`. До первой колоды — только это и scaffold-данные (см. фазу 0).

## Что известно из разведки

### A. Путь TypeScript в старом Морфе (mrph main @ 70a50a7)

Профиль `typescript` (`cards/language.py:139-165`): цели `{pkg}/{name}.ts` +
`tests/{name}.test.ts`, судья `tests/{name}.examples.test.ts`; parse `npx tsc --noEmit`
(на весь проект, не на файл); тесты `npx vitest run … --reporter=dot`; `guards = {}`;
helpers `tests/helpers.ts` (планировщик его не создаёт и в срезы не кладёт); имена
файлов snake_case. Выбор профиля: `language:` на Component, иначе `map.language`, иначе
python (`plan_spec.py:546`).

Нарезка (`cards/plan_spec.py`): Function → карта `slug(name)`; `calls` → `depends_on`;
`map.groups` → одна карта; Interface с одной Function складывается в неё; Data Object
по `reads/modifies/produces` входит текстом в инструкцию; `--judge` даёт карту-судью на
каждую карту с кодовой целью, срез судьи = docs + первый кодовый target; бюджет
`min(48000, 12000 + 2000·steps + 4000·(members−1) + 500·examples)`, `variants: 2` при
≥3 шагах или группе. `map.cards[<id>]`: `instruction` = **открывающая** секция карты
(PR #31), `context_slice` и `depends_on` **заменяют** вычисленные, остальное копируется.
Срез по умолчанию = docs + первый кодовый target каждой зависимости; **запись в срез
не кладётся** (PR #30). `deck check`: write-write и read-write в одном поколении —
ошибка; `oversized-slice` при 500 КБ — предупреждение (`--slice-cap-bytes`).

Пробелы TS против python, которые план обязан закрыть картами или картой-данными:
1. Стражей нет: Guardrail для TS — только проза. Проверки нужны как override `acceptance`
   (ESLint `no-restricted-imports`, grep по `import`).
2. `npx tsc` вместо `node_modules/.bin/tsc` (урок фазы 16); tsc проектный — красный файл
   соседа краснит все карты поколения.
3. Нет стадии `npm ci`: `node_modules` и lock-файл ставятся как данные до прогона.
4. `tests/helpers.ts` создаёт только extra-карта scaffold; срезы судей надо
   переопределять в map, иначе helpers не виден.
5. Карта без `.ts` в целях (json, css) получает пустую приёмку — override обязателен.
6. tree-sitter-typescript в venv стенда нет: синтаксический гейт для TS молча пропущен.
7. Счётчик тестов primer только для Python (TS-репо покажет «0 test functions»).

Чеклист записи+map для TS greenfield: `version: 1`; `language: typescript` на каждом
Component; у каждой Function `behavior` и `examples` с полными литералами; `calls` на
каждую реальную зависимость; объединения типов как литеральные union, не `string`;
`docs` в map маленькие; `extra_cards`: scaffold (package.json, tsconfig, vitest.config,
tests/setup.ts с блокировкой сети, tests/helpers.ts) с собственной приёмкой, запускается
отдельным поколением первым; `cards.<id>.context_slice`/`depends_on` перечисляют deps +
`scaffold` + `tests/helpers.ts`; `cards.<id>-judge.context_slice` с helpers; сухой
`plan --spec` до гейта.

### B. Как начинались проекты, построенные Морфом

- **ccledger** (Python): запись 220 строк, 6 Function, 4 Data Object со `schema`, без
  `examples` (они появились позже в фикстуре `ccledger.examples.contour.yaml`). Руками до
  первой колоды: коммит 1 — только `.gitignore` (`.morph/*` кроме `!.morph/runs/`);
  коммит 2 — пустой `__init__.py`, `contour.yaml`, `docs/TASK_ccledger.md`, анонимные
  фикстуры. Колода v1: 6 карт, поколение 1 — четыре листа параллельно, затем ledger,
  затем cli. 6/6, 93 теста, $0.093; 6 из 8 красных — число в спеке, посчитанное не
  правилом контракта.
- **contour-engine-morph**: 8/8 карт, 134 теста, 2 338 строк кода, $2.34, ≈32 сожжённых
  попытки, 0 от записи. Порядок фаз: листья (schema, store, diagram) → engine → интерфейсы
  (rest, mcp). Карта «код + свой тест» не сходится в одном ответе (engine 0/12, rest 0/9);
  лечение — разделить: карта кода с узкой приёмкой по внешнему артефакту + **карта-судья
  следующего поколения** с тестами из EXAMPLES (55 примеров given/when/then, 12
  интерпретаций).
- **ETHSmartChecker, фаза 16 (TS внутри Python-репо, 02.10)**: запись 6 810 строк,
  `language: typescript` на группе `dashboard-ui`; описание группы называет раскладку
  модулей. **Scaffold — отдельная карта `ui-scaffold`, прогнанная одна** (run A): цели
  `package.json`, `tsconfig.json`, `vite.config.ts` (vitest-конфиг внутри: happy-dom,
  `setupFiles: tests/setup.ts`, `chaiConfig.truncateThreshold: 200`), `index.html`,
  `tests/setup.ts` (fetch/XHR/WebSocket/net.connect бросают «network blocked in tests»),
  `tests/helpers.ts` (фикстуры через `fileURLToPath(import.meta.url)`, fakeFetch,
  fakeClock, flush; импорты только `node:*`). Принята со второй попытки, $0.0226;
  `package-lock.json` закоммичен руками как данные; затем run B — 10/10 карт за $0.124.
  Пины: typescript 5.9.3, vitest 3.2.7, vite 7.3.6, happy-dom 20.14.5, @types/node 22.20.5;
  tsconfig strict, ES2022, module ESNext, moduleResolution bundler.
  **Сборщик приёмок** `decks/phase16-tooling/build.py` (284 строки) + `parts/guard.mjs`
  (AST-страж через typescript compiler API, без ESLint) + `parts/*.probe.ts`: шаги
  `[ -d node_modules ] || npm ci` → `node_modules/.bin/tsc --noEmit` → guard → проба →
  свой тест → полный прогон → frozen (`git diff --quiet` по чужим файлам) → untracked.
  Урок: проба проверяла значения helpers, не типы (`kind: string` вместо union) — нужна
  типовая проверка `const _: T = …` в пробе.

Вывод для MorphV2 (repo в корне, без `cd dashboard`): коммит 1 — `.gitignore`; коммит 2 —
`contour.yaml`, `docs/TASK_*.md`, фикстуры, `morph-map.json`, сборщик приёмок
(`decks/p0-tooling/build.py`, `parts/guard.mjs`, `parts/scaffold.probe.ts`); колода 0 — одна
карта scaffold, одна; затем lock-файл руками; дальше карта кода + карта-судья на каждую
Function с первого дня.

### C. Headless-контракт старого Морфа (что V2 переопределяет своей схемой)

Правило вывода: один JSON на stdout, человеческий лог на stderr, `--pretty`, `--root`
(каталог с `.morph/`); ошибка — `{"error":{"code","kind","message"}}`; коды: 0 ок,
1 карты провалены/пропущены, 2 владение/грязное дерево, 3 транспорт, 4 usage.

| команда | флаги | возвращает |
|---|---|---|
| `deck add --file` | — | `{added, hazards}`; hazards сообщаются, не отказ |
| `deck check` | `--slice-cap-bytes` | `{cards, errors, warnings, hazards}`; exit 2 при error-hazard |
| `deck status` | — | `{empty, phase, current_generation, generations, cards:[{custom_id,status}]}`; статусы pending/in_flight/written/failed/skipped |
| `deck reset` / `deck clear` | — | reset удаляет state, clear — backlog; clear отказан при phase=submitted |
| `submit` | `--processor --nogit --route batch\|sync` | `{submitted, done, generation, total, batch_id, cards, skipped:[{custom_id, blocked_by}]}` |
| `collect` | `--wait --timeout 21600 --route` | `{in_progress, generation, total, phase, outcomes, retry:{in_flight, submitted, attempt, limit, cards, batch_id}}` |
| `run` | `--processor --nogit --timeout --route --max-cards --max-regenerations --deadline` | архивный отчёт + counts; exit 0 только если все written |
| `scout` | `--issue FILE\|- --processor --protocol --base --max-calls/-reads/-chars/-rounds --deadline 1800 --no-round0 --stub --seed-from-primer\|--seed-file` | `{scout_id, status, path, ref, answer, spent, budgets, stop_reason, usage}` |
| `plan` | ровно одно из `--from-scout ID\|latest` / `--spec PATH`; spec: `--component* --package --map --judge`; общие: `--add --slice-cap-bytes --headroom --processor --reasoning-*` | колода; без `--add` ничего не пишет |
| `primer` | `--write [PATH]` | `{root, generated_at, repo, runs, markdown, chars, written}` |
| `report [deck_id]` | — | архивный отчёт, последний по умолчанию; exit 4 если нет |

Две поправки к моим прежним представлениям (важны для записи V2): откат отклонённой
попытки идёт из **байтового снимка целей в памяти**, не через git (git даёт ветке прогона
по коммиту на принятую карту); `--max-regenerations` — потолок на **число батчей
перегенерации за прогон**, а предел попыток на карту фиксирован: 2 повтора, 3 попытки.

**Артефакты старого Морфа** (V2 заменяет своей схемой, но набор понятий тот же): карта
`{custom_id, intent generate|patch|todo, targets, context_slice, instruction, acceptance,
model, max_tokens, reasoning_*, variants, depends_on}`; `deck.json` (backlog),
`state.json` (phase idle|submitted|done, generations, retries, input digests,
outcomes), `runs/<id>/{deck.json, report.json}` (outcomes `{status written|failed|
skipped|budget-exceeded, reason, attempts, winning_variant, acceptance_output,
earlier_failures, commit, diffstat, syntax_gate}`, `usage_totals`), `decks/<id>.json`
в репо, трейлеры `Morph-Card/-Model/-Variant/-Acceptance/-Acceptance-Exit` на карту и
`Morph-Run/-Cards/-Written/-Failed/-Skipped` на архив, `scout/<id>/scout.json`,
`plans/<cid>.json`, `rejected/`, `primer.md` (≤16 000 символов).

**Цикл прогона**: поколения = длина пути по `depends_on`; preflight (write-write —
отказ, read-write — починка ребром, implicit/unordered-read — предупреждение); компиляция
(generate: контекст + инструкция + директива формата; patch: `<original_file>` на цель;
пустой срез = весь проект через фильтр расширений); submit → poll 1 с → collect →
`process_generation`: протухшие входы (sha256 деклар. входов) — ответ выброшен;
`verify_card` best-of-N: снимок байтов → запись → синтаксический гейт → приёмка
(shell, cwd=root, 300 с, вывод 4 000 симв. с спасением строк диагноза) → первый зелёный
побеждает, иначе откат всех; перегенерация `<cid>.rN` с `<acceptance_output>` и
`<previous_attempt_diff>` (≤6 000), предел 2 повтора; карты без приёмки не
перегенерируются; хук `on_accepted` → коммит; бюджет прогона (`max_cards`,
`max_regenerations`, `deadline`) проверяется на границах поколений. Ожидание: backoff
5→120 с без джиттера, `monotonic`, PERMANENT = KeyboardInterrupt/SystemExit/MemoryError,
один дедлайн на всё ожидание. Ответ модели: `FILE: <path>` секции строго по целям, нечётное
число fence = обрезка.

**Процессоры**: реестр из env `MRPH_PROCESSOR_<ID>_*` (TYPE, MODEL, API_KEY, ROUTE
batch|sync, CONCURRENCY, PROVIDER_ORDER, REASONING_*, TIMEOUT, MAX_RETRIES); маршруты —
batch (OpenAI Batch API, Anthropic Message Batches, OpenRouter `/api/beta/batches` inline)
и sync (локальный планировщик слотов, одна нить на запрос); request assembly: `provider
{order, allow_fallbacks:false}` только на sync, `reasoning`, `tools`, без `tool_choice`
(404 у закреплённых провайдеров); usage/cost по `request_id` боковым каналом; scout —
отдельная строка `orchestrator_usage`.

**Размеры оригинала** (строк): store 1912, generations 1830, plan_spec 997,
scout_explorer 868, scout 865, primer_view 767, compiler 751, acceptance 682,
syntax_gate 633, cli 529, batch 1065, registry 793; cards+processors 18 594, тесты 28 287.

**Таблица Component-кандидатов V2** (из разведки): CLI Shell (~2 000) · Card & Deck
Model (~1 000) · Deck Store & Run State (~1 300) · Run Archive & Git (~1 220) · Compiler
(~860) · Response Parser (~560) · Acceptance (~1 500) · Run Loop (~1 460) · Resilient
Wait (320) · Processor (~2 675) · Scout (~2 220) · Planner (~1 940) · Primer (~1 850).

## Эпики и фазы

Порядок эпиков (из разведки и предложения планировщика; каждая фаза = один Component
записи, 6–10 карт, ≤ $5):

| # | эпик | фазы | почему здесь |
|---|---|---|---|
| E1 | Core | P0–P11 | всё остальное — потребители ядра; листья с чистыми примерами (cards, compiler/response), затем IO (store, acceptance, git), затем цикл и оболочка |
| E2 | plan --spec | P12–P13 | условие самосборки: V2 обязан резать колоду из `contour.yaml`, прежде чем строить что-либо сам; нужны language (P4) и cli (P10) |
| — | хвост Core | P14 | OpenRouter batch — **первая dogfood-фаза**: хорошо фикстурируется, низкий риск, честная проверка планировщика V2 против старого |
| E3 | primer | P15 | нужны трейлеры git (P9) и архив (P3); нужен scout для семени и reviewer |
| E4 | scout | P16–P17 | нужны processor sync (P11), wait (P4), primer (P15) |
| E5 | reviewer | P18 | потребляет чтение записи (P12), primer, scout, diffstat git; последний по зависимостям, не по важности |

Вехи: **e2e на stub-процессоре в vitest** — после P8 (runloop на `stubProcessor` из P7);
**из бинаря `morph`** — после P10 (`morph deck add` → `morph run --processor stub`);
**свой прогон на glm** — после P11, колоды ещё режет старый `mrph`; **переключатель
dogfooding** — после P13: с P14 V2 режет и гоняет каждую следующую фазу, старый `mrph`
остаётся запасным, если колода V2 не проходит собственный `deck check`.

Guardrail слоёв, проверяемый `guard.mjs` на каждой карте: `cards` не импортирует ничего
внутреннего; `store`, `compiler`, `response`, `acceptance`, `language`, `wait`, `git`
импортируют только `cards`/`wait`; `processor` — `wait`; `runloop` — всё перечисленное;
`cli` — всё; `node:child_process` только в `acceptance` и `git`; `fetch` только в
`processor`; runtime-зависимость одна — `yaml`; `any` — ошибка ESLint.

Общие данные фазы, сделанные руками до прогона: `decks/pN-<comp>/map.json` (генерируется
`decks/tools/mapgen.py` из `contour.yaml`: camelCase `targets`, срез судьи =
`docs/CONVENTIONS.md` + кодовая цель + `tests/helpers.ts`, `depends_on` += `scaffold`);
приёмки собирает `decks/tools/build.py`; пробы в `decks/pN/parts/`; фикстуры в
`tests/fixtures/`. `docs/CONVENTIONS.md` ≤ 3 КБ — единственная запись `docs`; запись
Contour в срез не идёт. Судья дополнительно проверяется `guard.mjs`: не меньше одного
`it(` на пример и каждый литерал из `examples` Function присутствует в тесте.

### Фазы

Оценка $ — номинал $0.02–0.15 на карту × 1.5 на перегенерации; потолок всегда $5.
Имена Function здесь — глаголы-функции TypeScript; в записи они же как Function
(`Validate Card` ↔ `parseCard` и т.д., соответствие фиксируется в map `targets`).

**E1 Core — листья**

| фаза | Component | Function (код + судья на каждую) | карт / рёбра | оракул и фикстуры | руками до прогона | $ | риск → лечение |
|---|---|---|---|---|---|---|---|
| **P0** | scaffold (одна карта, одна) | `package.json` (bin `morph`→`dist/cli.js`; runtime-dep только `yaml`; dev: typescript 5.9, vitest 3.2, @types/node 22, eslint 9, typescript-eslint 8, tsx), `tsconfig.json` (strict, ES2022, NodeNext), `tsconfig.build.json`, `vitest.config.ts` (setupFiles, truncateThreshold 200), `eslint.config.js`, `tests/setup.ts` (сеть заблокирована), `tests/helpers.ts` (tmpRoot, tmpRepo, fakeFetch, fakeClock, fixture()), `src/index.ts` | 1 | `parts/scaffold.probe.ts` с **типовыми** утверждениями (`const _: FakeClock = fakeClock()`), пины grep-ом; `npm install` → tsc → eslint → vitest | коммит 1 `.gitignore`; коммит 2 `contour.yaml`, `morph-map.json`, `docs/PLAN.md`, сборщики | 0.05 | дрейф пинов/сеть → точные версии в инструкции; после приёмки оператор коммитит `package-lock.json`, дальше `npm ci` |
| **P1** | cards | parseCard (JSON→Card, union intent), layerDeck (поколения, ошибка цикла), detectHazards (write-write error, read-write, implicit-read), weighSlice (байты, cap) | 8; layer/hazards/weigh → parseCard | `fixtures/decks/{tiny,cycle,hazards}.json`, литералы вида `[["a","b"],["c"]]` | фикстуры, map | 0.7 | tsc проектный, 3 карты параллельно в поколении 2 → `build.py` даёт карте свой `tsconfig.<card>.json`, исключающий цели соседей; полный прогон ловит межкарточные ошибки |
| **P2** | response | splitSections (`FILE:` блоки), checkFences (нечётное = обрезано), stripFraming (обёртка/проза, без привязки к языку), matchTargets (лишние/недостающие против целей) | 8; matchTargets → splitSections | `fixtures/responses/*.md` — 4–6 **записанных** ответов glm из `morph-lab/.morph/runs` и `rejected/` (чистый на 2 файла, обрезанный, в прозе, путь вне целей) | фикстуры | 0.6 | жадный strip съедает код → примеры «оставить как есть» с литеральными телами |
| **P3** | store | deckId (sha256 отсортированных id, 12 hex), readDeck/writeDeck (`.morph/deck.json` + `state.json`, atomic tmp+rename), beginRun (`runs/<id>/deck.json`, phase), recordOutcome (append в report) | 8; beginRun → writeDeck; recordOutcome → beginRun | литерал deckId для `tiny.json`, посчитанный `sha256sum` при написании записи; tmpRoot на тест | — | 0.7 | хрупкая FS → tmpRoot; Guardrail «записи только в `.morph/`» grep-ом в guard |
| **P4** | wait + language (два `--component`) | wait: nextDelay (5,10,20,40,80,120 cap), waitFor (предикат, дедлайн, инжектируемые часы, permanent-ошибки наружу); language: resolveProfile (component→map→typescript), cutTargets (profile, pkg, name → camelCase пути), acceptanceTemplate (tsc/vitest против py_compile/pytest) | 10; waitFor → nextDelay; acceptanceTemplate → resolveProfile | литералы последовательностей; литерал пути `src/cards/parseCard.ts` | — | 0.8 | реальные таймеры в тестах → guard запрещает `setTimeout` под `tests/`, только fakeClock |

**E1 Core — IO и цикл**

| фаза | Component | Function | карт / рёбра | оракул и фикстуры | руками | $ | риск → лечение |
|---|---|---|---|---|---|---|---|
| **P5** | compiler | digestInputs (sha256 на деклар. вход), gatherSlice (только явные пути, фильтр расширений, пустой срез = ОШИБКА), buildMessages (generate против patch с `<original_file>`, директива `FILE:`, вариант), renderRetry (`<acceptance_output>` ≤4000, `<previous_attempt_diff>` ≤6000) | 8; buildMessages → gatherSlice; renderRetry → buildMessages | `fixtures/project-a/` (3 файла, литералы дайджестов в примерах); литералы числа/ролей сообщений | дерево фикстуры, map | 0.8 | неверный литерал дайджеста в записи → считать `sha256sum` и проверять скриптом до `plan` |
| **P6** | acceptance | snapshotTargets (байты в памяти, restore()), runCommand (shell, cwd root, таймаут по умолчанию 300 с, 4000 симв. со спасением строк диагноза), diffAttempt (unified ≤6000), verifyBestOfN (snapshot→write→синтакс. проверка профиля→команда→первый зелёный, иначе restore всех) | 8; verifyBestOfN → три | команды `exit 0` / `exit 1` / `sleep 5` при таймауте 200 мс; литерал восстановленных байтов | map, ручная проба runCommand | 0.9 | таймаут оставляет дочерний процесс → spawn detached и kill группы процессов; пример утверждает отсутствие сироты |
| **P7** | processor (ядро) | readRegistry (`MORPH_PROCESSOR_<ID>_TYPE/MODEL/API_KEY/ROUTE/CONCURRENCY/PROVIDER_ORDER/REASONING_*/TIMEOUT/MAX_RETRIES`, ID `[A-Z0-9]+`), assembleRequest (provider order только на sync, reasoning, никогда tool_choice), stubProcessor (воспроизводит `fixtures/stub/<id>[.rN].md`, нулевой usage), accountUsage (токены, cost) | 8; stub/assemble → readRegistry | литерал env → литерал реестра; записанные `chat.completion.json` и `generation.json` (из фикстур старого mrph, иначе один реальный вызов за $0.01) | — | 0.7 | неоднозначность `_` в ID → Guardrail с литеральным regex, пример `MORPH_PROCESSOR_GLM_API_KEY` |
| **P8** | runloop | resolveRunnable (deps written → runnable; skipped `{id, blocked_by}`), processGeneration (сброс по дайджесту, verify, retry ≤2 = 3 попытки), runDeck (поколения, бюджет maxCards/deadline, nogit, хук onAccepted), summarizeRun (счётчики, код выхода) | 8; цепочка по порядку | e2e-фикстура `fixtures/e2e/`: колода a,b→c + ответы stub, пишущие в tmpRoot; литерал отчёта written:3, generations:2. **ВЕХА: первый прогон колоды end-to-end на stub в vitest** | — | 1.0 | самая большая Function → runDeck ≤200 строк в одном файле, хуки инжектируются; `--max-regenerations` выброшен |
| **P9** | git | ensureBranch (`morph/<runId>`, грязное дерево → exit 2), commitCard (трейлеры Morph-Card/-Model/-Variant/-Acceptance/-Acceptance-Exit), archiveRun (`decks/<id>.json`, Morph-Run/-Cards/-Written/-Failed/-Skipped), diffstat | 8; archiveRun/commitCard → ensureBranch | `tmpRepo()` строит репо в тестах; точный текст трейлеров литералом | helpers выставляют `GIT_AUTHOR_*`/`COMMITTER_*`, `commit.gpgsign=false` | 0.8 | нет git identity на стенде → env в helpers; guard запрещает child_process вне git/acceptance |

**E1 Core — оболочка и провайдер; E2 plan --spec; хвост Core**

| фаза | Component | Function | карт / рёбра | оракул и фикстуры | руками | $ | риск → лечение |
|---|---|---|---|---|---|---|---|
| **P10** | cli | parseArgs (`--root --pretty`, команды), deckCommands (add/check/status/reset/clear; clear отказан при phase submitted), runCommands (run/report), emitResult (один JSON на stdout, конверт `{error:{code,kind,message}}`, exit 0/1/2/3/4) | 8; deck/run → parseArgs; emitResult лист | in-process `main(argv, io)`; один дымовой тест запускает `node dist/cli.js` после `tsc -p tsconfig.build.json`. **ВЕХА: первый headless e2e из бинаря `morph` на stub** | map, дымовая проба | 0.9 | spawn-тесты медленные/хрупкие → по умолчанию in-process, один spawn |
| **P11** | processor-openrouter (sync) | sendSync (fetch, 429/5xx повтор через nextDelay), scheduleSlots (конкурентность, порядок сохранён), fetchCost (`/generation` по id запроса), mapTransportError (транспорт → exit 3, usage → exit 4) | 8; scheduleSlots/fetchCost → sendSync | fakeFetch + записанные JSON (200, 429, 5xx, generation); один реальный вызов оператора после приёмки (~$0.01). **ВЕХА: V2 гоняет колоду на glm, колоды ещё режет старый mrph** | — | 0.8 | сеть в тестах → `tests/setup.ts` блокирует; Guardrail «fetch только через инжектированный клиент» grep-ом |
| **P12** | contour | parseContour (yaml → типизированная запись), validateContour (behavior+examples обязательны, union литеральные, неизвестные ключи отвергаются), readMap (version 1, language, docs, groups, cards, extra_cards), selectComponents (`--component*`, граф calls) | 8; validate/select → parse | `fixtures/contour/mini.yaml` (2 Component, 4 Function) + `mini.map.json`; строки ошибок литералом | — | 0.8 | рыхлые формы yaml → литеральные union с примерами ошибок |
| **P13** | planner | cutCards (Function → карта, calls → depends_on, groups → одна карта, текст Data Object, формула бюджета), cutJudges (examples в инструкцию, срез = docs + target + helpers **по умолчанию**), applyOverrides (instruction = открывающая секция, slice/deps заменяют, targets); + patch-карта cli: `plan --spec --component* --map --judge --add` | 9; judges/overrides → cutCards; patch → все | золотая `fixtures/contour/mini.deck.json` руками; перекрёстная проверка: старый `mrph plan --spec` на том же mini даёт те же id/deps (не байты). **ВЕХА: переключатель dogfooding после приёмки** | — | 1.0 | золото уходит от намерения → выводится из примеров, оператор смотрит |
| **P14** | processor-batch — **ПЕРВАЯ ФАЗА, СОБРАННАЯ V2** | submitBatch (OpenRouter `/api/beta/batches` inline), pollBatch, collectBatch (по id); + patch cli: `submit`, `collect --wait --timeout` (phase submitted) | 7; линейно | записанные JSON батча (3 состояния); fakeClock для ожидания | фикстуры; колоду режет V2, старый mrph — запас, если колода V2 не проходит собственный `deck check` | 0.7 | колода V2 хуже старой → `deck check` на обеих, diff колод записывается как первое измерение dogfooding |

**E3–E5 primer, scout, reviewer**

| фаза | Component | Function | карт / рёбра | оракул и фикстуры | руками | $ | риск → лечение |
|---|---|---|---|---|---|---|---|
| **P15** | primer | scanRepo (дерево, размеры, тесты **по профилю**: TS считает `it(`/`test(`), readOwnership (`git log --format=%(trailers)` → файл → карта/модель/прогон), readRuns (архивы → сгоревшие попытки, коды приёмок), renderPrimer (markdown ≤16000); + patch cli: `primer --write [PATH]` | 9; render → три | tmpRepo с 3 коммитами с трейлерами; литералы строк владения; литерал предела | map | 0.9 | разбор трейлеров regex-ом → только `%(trailers)`; фикстурный коммит с многострочным телом |
| **P16** | scout-protocol | parseProtocol (READ/GREP/LIST/ANSWER), executeAction (клетка путей через realpath, предел символов), budgetScout (calls/reads/chars/rounds/deadline → stop_reason), seedFromPrimer (сообщения раунда 0) | 8; executeAction → parseProtocol | фикстурный транскрипт; `../etc/passwd` и побег через symlink → литерал ошибки; синтетический мини-корпус (soc-dashboard остаётся локальным) | — | 0.8 | побег через symlink → пример Guardrail с symlink внутри tmpRoot |
| **P17** | scout-loop | runScout (раунды, `--no-round0`, stop_reason, usage), recordScout (`scout/<id>/scout.json`, строка orchestrator_usage), planFromScout (ответ → patch-карты на названные файлы); + patch cli: `scout`, `plan --from-scout ID\|latest` | 7; линейно | stub-процессор со сценарием действий → литеральный ответ; дедлайн на fakeClock | — | 0.8 | цикл не останавливается → у каждого stop_reason есть пример |
| **P18** | reviewer | collectReviewInputs (дифф ref/прогона, цели карт, запись, scout, primer), checkEnvelope (файлы вне целей), checkGuardrails (Guardrail с полем check = правило eslint или grep), renderFindings (`{expected, got, source}` + числа); + patch cli: `review` | 9; render → три | фикстурный репо + дифф + запись с одним нарушенным Guardrail → одна литеральная находка | — | 0.9 | ревьюер начинает чинить → Guardrail «без записей», шаг frozen |

**Итого:** 19 фаз (P0–P18), ≈148 карт, номинал ≈$15, худший случай ограничен 19 × $5.
Строитель записи: старый `mrph` для P0–P13, V2 для P14–P18.

### Что V2 выбрасывает или меняет против старого Морфа

- `intent: todo` — в headless никогда не исполнялся; только `generate|patch`.
- Карты-повторы `<cid>.rN` и суффиксные копии вариантов — попытки и варианты живут внутри одной записи исхода.
- Снятие `---`-обёртки только для `.py` — слой response нейтрален к языку.
- Неявный срез «весь проект» при пустом `context_slice` — ошибка `deck check`; только явные пути (срезы в 478 КБ выросли из этого).
- Синтаксический гейт tree-sitter — заменён командой профиля (tsc / py_compile); нет молчаливого пропуска.
- `--max-regenerations` — путаная семантика; заменён числом попыток на карту (по умолчанию 3) и `--deadline`.
- Карта без кодовой цели с пустой приёмкой — ошибка `deck check`, если не сказано явно `acceptance: none`.
- Срез судьи без `tests/helpers.ts` — профиль добавляет helpers по умолчанию.
- Маршруты batch OpenAI/Anthropic — только OpenRouter (sync + batch); другие вендоры — поздний профиль.
- `MRPH_PROCESSOR_*` → `MORPH_PROCESSOR_*`; `custom_id` → `id`.
- snake_case имена файлов по умолчанию — TS-профиль режет camelCase, dogfood-фазы не нуждаются в override `targets`.
- Счётчик тестов primer только для Python — счётчики по профилю.
- **Сохранено намеренно:** откат из байтового снимка в памяти; один коммит на принятую карту; hazards на `deck add` сообщаются, не отказ; `plan` без `--add` ничего не пишет; пределы 4000/6000 (теперь настраиваемые).

### Замеры по ходу (`docs/MEASURE.md`, строка на фазу)

| метрика | откуда |
|---|---|
| строитель | старый mrph / V2 |
| карт запланировано / принято / сгоревших попыток | отчёт прогона |
| $ исполнителя / $ сессии оркестратора | OpenRouter / сессия Claude |
| минуты стены | от `plan` до последнего коммита |
| tsc-first-red | карты, чья первая попытка упала только на шаге tsc |
| neighbour-red | провалы, вызванные соседней картой того же поколения |
| дефекты судьи | тесты судьи красные на принятом коде (пропущенные дефекты) |
| заглушки судьи | карты-судьи, отвергнутые стражем «литералы/`it(`» |
| строк руками | map + пробы + фикстуры до прогона |
| hazards `deck check` | починено руками до прогона |
| макс. байт среза | из `deck check` |

### Решения по открытым вопросам планировщика

1. Два маленьких Component в одной фазе через повторный `--component` (P4): **да**, пока
   карт ≤ 10 и потолок $5 держится.
2–5. **Открыты, решает оператор перед P1** (рекомендации автора плана в скобках):
   2. tsc на весь проект краснит соседей по поколению → tsconfig на карту от сборщика
      (рекомендуется) или ≤2 карт в поколении.
   3. Переключатель P14 → резать обоими планировщиками и сравнить колоды (рекомендуется)
      или сразу колода V2.
   4. Карты-судьи → glm-5.3 как код (рекомендуется; sonnet через morph-agent-run, если
      страж «литералы/`it(`» начнёт отвергать заглушки).
   5. Записанные ответы glm и JSON OpenRouter из morph-lab как фикстуры → да, после
      очистки id и ключей (рекомендуется).

## Нулевой Контур (черновик `contour.yaml`)

Принципы записи: один System `MorphV2`; **каждый Component = одна область фаз**, у всех
`language: typescript`; `calls` между Function — единственный источник `depends_on`;
Data Object со `schema` для всего, что исполнитель обязан *сконструировать*; `examples`
с полными литералами там, где истина уже известна (фазы 0–2: модель карты, слоение,
hazards, документ ошибки, директива формата, разбор ответа); у поздних Component пока
только `description`/`behavior`/`steps` — их `examples` пишутся перед своей фазой из
фикстур (записанные ответы OpenRouter, тестовый git-репозиторий, образцы колод). Запись
на английском: исполнитель glm читает её дословно в инструкции карты.

```yaml
version: 1
System:
  name: MorphV2
  description: >
    Headless orchestrator of batch code generation. An operator or an agent writes a
    Contour record and a map; `morph plan` cuts them into a deck of cards; `morph run`
    compiles each card into one request per variant, sends the generation to a
    processor, judges every answer with the card's acceptance command, commits what
    passes with trailers, regenerates what fails with the diagnosis, and archives the
    run. `morph primer` digests the project and its archive for a fresh session,
    `morph scout` localises a change with a cheap model, `morph review` checks a diff
    against the record, the primer and a scout report. One JSON document on stdout,
    the human log on stderr, exit codes 0/1/2/3/4. No REPL.
  requirements: [Strict TypeScript, One Document Out, Deterministic Core, Node Only]
  guardrails: [No Network In Tests, No Shell Outside Acceptance, Frozen Tree During Run]
  groups:

    # ---------------------------------------------------------------- P1
    - name: cards
      description: >
        The card and deck model: src/cards/*.ts. Validates a card, loads a deck,
        layers it into generations by depends_on, finds ownership hazards and weighs
        slices. Pure: no filesystem beyond reading the files a slice names, no git.
      language: typescript
      requirements: [Deterministic Core]
      functions:
        - name: Validate Card
          description: Turns an untrusted object into a Card or a list of faults.
          behavior: >
            Required: customId matching ^[A-Za-z0-9._-]+$, intent generate|patch,
            targets a non-empty list of distinct repo-relative paths, instruction a
            non-empty string. Optional with defaults: contextSlice [] (empty means
            "no context, instruction only" — never the whole project), acceptance
            null, model null, maxTokens null, reasoning null, variants 1, dependsOn [].
            Unknown keys are faults, never ignored. Every fault names the key and the
            rule in one line; all faults are reported at once.
          steps:
            - produces: Card
          examples:
            - given: '{"customId":"a","intent":"generate","targets":["src/a.ts"],"instruction":"x"}'
              when: "validated"
              then: "a Card with contextSlice [], variants 1, dependsOn [], acceptance null"
            - given: '{"customId":"bad id","intent":"generate","targets":["src/a.ts"],"instruction":"x"}'
              when: "validated"
              then: "one fault: customId 'bad id' does not match ^[A-Za-z0-9._-]+$"
            - given: '{"customId":"a","intent":"todo","targets":[],"instruction":""}'
              when: "validated"
              then: "exactly three faults, in key order: intent, targets, instruction"
            - given: '{"customId":"a","intent":"generate","targets":["src/a.ts","./src/a.ts"],"instruction":"x"}'
              when: "validated"
              then: "one fault: targets repeat src/a.ts after normalisation"
        - name: Load Deck
          description: Reads a deck file (a JSON array of cards) into a Deck.
          behavior: >
            Every element is validated with Validate Card; duplicate customIds and a
            dependsOn cycle are deck faults; a dependsOn naming a card outside the deck
            is external and allowed. The Deck keeps file order.
          steps:
            - calls: Validate Card
            - reads: Deck File
            - produces: Deck
          examples:
            - given: "a file with cards a, b, b"
              when: "loaded"
              then: "one deck fault: duplicate customId b"
            - given: "cards a (dependsOn [b]) and b (dependsOn [a])"
              when: "loaded"
              then: "one deck fault naming the cycle a -> b -> a"
            - given: "card a with dependsOn [zzz] and no card zzz"
              when: "loaded"
              then: "no fault; externalDependsOn of the Deck is ['zzz']"
        - name: Layer Generations
          description: Orders a Deck into generations by the longest dependsOn path.
          behavior: >
            Generation of a card = 1 + max generation of its in-deck dependencies, 0
            for none; external dependencies do not count. Within a generation, deck
            order is kept. Returns a list of lists of customIds.
          steps:
            - calls: Load Deck
          examples:
            - given: "cards a, b (dependsOn [a]), c (dependsOn [a]), d (dependsOn [b, c])"
              when: "layered"
              then: "[['a'], ['b', 'c'], ['d']]"
            - given: "cards a (dependsOn ['ext']), b"
              when: "layered"
              then: "[['a', 'b']]"
        - name: Find Hazards
          description: Reports ownership conflicts between the cards of one deck.
          behavior: >
            write-write (two cards of one generation share a target) is an error;
            read-write (a card's contextSlice names a sibling's target in the same
            generation) is an error with a repair — add dependsOn from reader to
            writer; implicit-read (empty contextSlice) and unordered-read (a slice
            names a target of a card in a later generation with no dependsOn path)
            are warnings. Each hazard: kind, severity error|warning, cards, path,
            repair or null.
          steps:
            - calls: Layer Generations
            - produces: Hazard
          examples:
            - given: "a and b in generation 0, both with target src/x.ts"
              when: "hazards are found"
              then: "one hazard {kind: 'write-write', severity: 'error', cards: ['a','b'], path: 'src/x.ts', repair: null}"
            - given: "a writes src/x.ts, b reads src/x.ts in its slice, both generation 0"
              when: "hazards are found"
              then: "one hazard {kind: 'read-write', severity: 'error', cards: ['b','a'], path: 'src/x.ts', repair: {addDependsOn: {card: 'b', on: 'a'}}}"
        - name: Weigh Slices
          description: Sums the bytes of each card's contextSlice plus targets on disk.
          behavior: >
            Missing files count 0 and are listed. A card over the cap (default
            500000 bytes) gets an oversized-slice warning carrying the bytes and the
            cap.
          steps:
            - calls: Load Deck
            - produces: Hazard
          examples:
            - given: "a card whose slice files total 600001 bytes and the default cap"
              when: "weighed"
              then: "one hazard {kind: 'oversized-slice', severity: 'warning', bytes: 600001, cap: 500000}"
      dataObjects:
        - name: Card
          description: One unit of work for an executor; what morph run compiles into a request.
          schema:
            customId: "string, ^[A-Za-z0-9._-]+$"
            intent: "'generate' | 'patch'"
            targets: "string[] non-empty, repo-relative, distinct after normalisation"
            contextSlice: "string[] default []"
            instruction: "string non-empty"
            acceptance: "string | null — a shell command run from the repo root"
            model: "string | null"
            maxTokens: "number | null"
            reasoning: "{ maxTokens: number } | { effort: 'low'|'medium'|'high' } | null"
            variants: "number >= 1, default 1"
            dependsOn: "string[] default []"
        - name: Deck
          description: The loaded backlog.
          schema:
            cards: "Card[] in file order"
            externalDependsOn: "string[] — dependsOn names not in the deck"
        - name: Deck File
          description: "decks/<name>.json or .morph/deck.json — a JSON array of Card objects (flat form only)."
          schema: "Card[]"
        - name: Hazard
          description: One ownership or size finding.
          schema:
            kind: "'write-write' | 'read-write' | 'implicit-read' | 'unordered-read' | 'oversized-slice'"
            severity: "'error' | 'warning'"
            cards: "string[]"
            path: "string | null"
            repair: "{ addDependsOn: { card: string, on: string } } | null"
            bytes: "number | undefined"
            cap: "number | undefined"

    # ---------------------------------------------------------------- P2
    - name: compiler
      description: >
        Turns a Card and the files it names into provider-neutral requests, one per
        variant, and parses an answer back into target files: src/compiler/*.ts.
        Reads the slice and target files; never the network, never git.
      language: typescript
      requirements: [Deterministic Core]
      functions:
        - name: Compile Card
          description: Builds the conversation for one card.
          behavior: >
            generate: one user message per slice file, in sorted path order, each
            "Contents of file <path>:" followed by the file in a fenced block; then a
            user message with the instruction and the output directive. patch: the
            same, but each existing target is first given as "Original file <path>:"
            with its content; a target that does not exist yet is announced as "new
            file". Variants: N requests with customId <id>.v1..vN and identical
            messages. A slice file that does not exist is a compile fault, not a
            silent skip.
          steps:
            - reads: Card
            - calls: Capture Inputs
            - produces: Request
          examples:
            - given: "card a, intent generate, slice [docs/B.md, docs/A.md], variants 2"
              when: "compiled"
              then: "two Requests a.v1 and a.v2; messages[0] is docs/A.md, messages[1] docs/B.md, messages[2] the instruction + directive"
            - given: "card p, intent patch, targets [src/x.ts] which exists with 3 lines"
              when: "compiled"
              then: "the first message is 'Original file src/x.ts:' with those 3 lines fenced"
            - given: "a slice naming docs/missing.md"
              when: "compiled"
              then: "a compile fault naming docs/missing.md; no Request"
        - name: Output Directive
          description: The fixed tail of every instruction that tells the model how to answer.
          behavior: >
            One target: "Answer with the complete new content of <path> in one fenced
            block and nothing else." Several targets: "Answer with one section per
            file, each starting with a line `FILE: <path>` followed by one fenced
            block; every target exactly once, no other text."
          examples:
            - given: "targets [src/a.ts, tests/a.test.ts]"
              when: "the directive is rendered"
              then: "it names both paths in that order and the literal line prefix 'FILE: '"
        - name: Capture Inputs
          description: Digests the declared inputs of a card so a run can detect a change under its feet.
          behavior: >
            For every path in contextSlice and targets: sha256 hex of the bytes, the
            first 16 hex chars, or 'absent'. Sorted by path. Comparing two captures
            yields the list of changed paths.
          steps:
            - produces: Input Digest
          examples:
            - given: "src/x.ts with bytes 'a\\n' and an absent tests/x.test.ts"
              when: "captured"
              then: "{'src/x.ts': '87428fc522803d31', 'tests/x.test.ts': 'absent'}"
            - given: "a capture, then src/x.ts rewritten"
              when: "compared"
              then: "changed is ['src/x.ts']"
        - name: Parse Answer
          description: Splits a model answer into target contents.
          behavior: >
            Single target: the content is the first fenced block if any, else the
            whole text. Several targets: sections introduced by `FILE: <path>`; the set
            of paths must equal the targets exactly, otherwise the answer is corrupt
            and says which path is missing or extra. An odd number of fence lines
            means truncated. A leading line that is only `---` is dropped for any
            extension. Result: {files: {path: content}} or {corrupt: reason} or
            {truncated: true}.
          examples:
            - given: "targets [src/a.ts]; answer '```ts\\nexport const a = 1;\\n```'"
              when: "parsed"
              then: "files {'src/a.ts': 'export const a = 1;\\n'}"
            - given: "targets [src/a.ts, tests/a.test.ts]; answer with FILE: src/a.ts only"
              when: "parsed"
              then: "corrupt: 'missing section for tests/a.test.ts'"
            - given: "an answer with three fence lines"
              when: "parsed"
              then: "truncated: true"
      dataObjects:
        - name: Request
          description: One provider-neutral chat request.
          schema:
            customId: "string — '<cardId>.v<n>'"
            model: "string | null"
            maxTokens: "number | null"
            reasoning: "Card.reasoning"
            messages: "{ role: 'system'|'user'|'assistant', content: string }[]"
        - name: Input Digest
          description: Declared inputs of a card at compile time.
          schema: "{ [path: string]: string } — 16 hex chars or 'absent', keys sorted"
        - name: Parsed Answer
          description: The outcome of Parse Answer.
          schema: "{ files: { [path: string]: string } } | { corrupt: string } | { truncated: true }"

    # ---------------------------------------------------------------- P3 (skeleton — examples before the phase)
    - name: acceptance
      description: >
        Judges one card's answers: src/acceptance/*.ts. Snapshots the targets' bytes,
        writes a variant, runs the acceptance command with a timeout, keeps the first
        green variant, rolls everything back otherwise, and builds the diagnosis the
        retry carries.
      language: typescript
      guardrails: [No Shell Outside Acceptance]
      functions:
        - name: Snapshot Targets
          description: Remembers the bytes (or absence) of every target before writing.
          behavior: In memory, never through git. Restoring puts the bytes back or deletes the file.
        - name: Run Acceptance
          description: Executes the card's acceptance command from the repo root.
          behavior: >
            `sh -c` with cwd = root, env NO_COLOR=1 CI=1, timeout 300 s (a kill is
            exit null with the log kept); stdout+stderr merged; the log is clipped to
            4000 chars head+tail, keeping every line that looks like a diagnosis
            (FAIL, Error, assert, expected). Returns {exit, log, timedOut}.
          steps:
            - produces: Acceptance Result
        - name: Verify Card
          description: Best-of-N over the parsed variants.
          behavior: >
            For each variant in order: skip corrupt/truncated with a stand-in result;
            write the files; run the acceptance; on exit 0 keep and stop; else roll
            back and continue. Returns the winning variant or every result.
          steps:
            - calls: Snapshot Targets
            - calls: Run Acceptance
            - produces: Verify Outcome
        - name: Build Attempt Diff
          description: A unified diff of the failed variant against the snapshot, capped at 6000 chars.
      dataObjects:
        - name: Acceptance Result
          description: What one acceptance command run returned.
          schema: "{ exit: number | null, log: string, timedOut: boolean }"
        - name: Verify Outcome
          description: The result of best-of-N verification of one card.
          schema: "{ accepted: { variant: string } | null, results: { variant: string, exit: number | null, log: string, diff: string | null }[] }"

    # ---------------------------------------------------------------- P4 (skeleton)
    - name: processor
      description: >
        Talks to a model provider: src/processor/*.ts. Reads the registry from the
        environment, assembles the provider request, sends one generation (sync route
        first: one request at a time under a concurrency limit; batch route second),
        collects answers and usage. OpenRouter first; the processor interface is the
        only place the network is allowed.
      language: typescript
      functions:
        - name: Read Registry
          description: MORPH_PROCESSOR_<id>_* env vars into Processor Configs; invalid ones are listed, not dropped silently.
        - name: Assemble Request
          description: Request → provider JSON (OpenRouter chat completions) with provider.order + allow_fallbacks false when pinned, reasoning, usage.include; never tool_choice.
        - name: Send Generation
          description: Sends every Request of a generation, returns Answers and Usage per customId; retries transport errors with backoff; a provider refusal is recorded, not retried.
          steps:
            - calls: Assemble Request
            - produces: Answer
            - produces: Usage
      dataObjects:
        - name: Processor Config
          description: One processor as read from the environment.
          schema: "{ id, type: 'openrouter', model, apiKey, route: 'sync'|'batch', concurrency, providerOrder: string[] | null, reasoning, timeoutMs, maxRetries }"
        - name: Answer
          description: One model answer to one Request, or its failure.
          schema: "{ customId, text: string | null, finishReason: string | null, error: string | null }"
        - name: Usage
          description: Tokens and cost of one Request as the provider reported them.
          schema: "{ customId, inputTokens, outputTokens, cost: number | null, provider: string | null, generationId: string | null }"

    # ---------------------------------------------------------------- P5 (skeleton)
    - name: runloop
      description: >
        The run: src/run/*.ts. Resolves runnable cards per generation, compiles,
        sends, verifies, commits, retries with the diagnosis, records outcomes and
        archives. Owns the run state file and the archive layout.
      language: typescript
      guardrails: [Frozen Tree During Run]
      functions:
        - name: Resolve Runnable
          description: A card whose dependency failed or was skipped is skipped with reason = that dependency.
        - name: Process Generation
          description: compile → send → parse → verify per card; stale inputs discard the answer; accepted cards fire the commit hook.
          steps:
            - uses: compiler
            - uses: processor
            - uses: acceptance
            - produces: Card Outcome
        - name: Build Retry
          description: The retry card <id>.r<n> with <acceptance_output> and <previous_attempt_diff>; at most 2 retries per card; run-wide cap on retry batches.
        - name: Run Deck
          description: Generations in order, budget checked at boundaries (maxCards, maxRetryBatches, deadline), archive at the end.
          steps:
            - calls: Resolve Runnable
            - calls: Process Generation
            - calls: Build Retry
            - produces: Run Report
      dataObjects:
        - name: Card Outcome
          description: How one card ended in a run.
          schema: "{ customId, status: 'written'|'failed'|'skipped'|'budget-exceeded', reason: string | null, attempts, winningVariant, acceptanceLog, earlierFailures: string[], commit: string | null, diffstat }"
        - name: Run Report
          description: The archived summary of one run.
          schema: "{ runId, completedAt, branch, processor, generations, outcomes, usageTotals: { inputTokens, outputTokens, cost, requests } }"

    # ---------------------------------------------------------------- P6 (skeleton)
    - name: git
      description: >
        Branch, commit with trailers, diffstat, archive commit: src/git/*.ts over the git CLI.
      language: typescript
      functions:
        - name: Open Run Branch
          description: morph/<runId> from HEAD; refuses a dirty tree outside .morph/.
        - name: Commit Card
          description: >
            Stages exactly the card's targets; subject 'morph <id>: <targets>'; trailers Morph-Card, Morph-Model, Morph-Variant (if >1), Morph-Acceptance-Exit; returns sha and diffstat, or null when nothing changed.
        - name: Archive Run
          description: Writes .morph/runs/<runId>/{deck.json, report.json} and commits them with Morph-Run trailers.

    - name: cli
      description: >
        The `morph` binary: src/cli/*.ts. Parses argv, dispatches, prints exactly one
        JSON document on stdout, logs on stderr, maps every error to an exit code.
      language: typescript
      requirements: [One Document Out]
      functions:
        - name: Parse Command
          description: Subcommands deck add|check|status|reset|clear, run, scout, plan, primer, review, report; global --root and --pretty.
        - name: Emit Document
          description: One JSON document + newline on stdout, flushed; --pretty indents by 2.
        - name: Classify Error
          description: >
            A fault before any spend (ownership, dirty tree, invalid deck) → 2; a
            transport or provider failure → 3; a usage error (bad flag, missing file,
            invalid record) → 4; a run with any failed/skipped card → 1. Error document
            {"error": {"code", "kind", "message"}}.
          examples:
            - given: "`morph deck check` on a deck with a write-write hazard"
              when: "run"
              then: "stdout is one JSON document with errors >= 1; exit code 2"
            - given: "`morph frobnicate`"
              when: "run"
              then: '{"error":{"code":4,"kind":"UsageError","message":...}}; exit 4'
      interfaces:
        - name: morph CLI
          description: The only entry point.
          exposes: [Parse Command]

    # ---------------------------------------------------------------- later epics (skeleton)
    - name: language
      description: Language profiles (typescript first, python second) — what counts as code, the parse step, the test runner, default file names, the judge instruction, the acceptance template; the planner cuts by profile.
      language: typescript
      dataObjects:
        - name: Language Profile
          description: Everything the planner and the acceptance need to know about one language.
          schema: "{ id, extensions, testDirs, testFilePattern, codeTarget, testTarget, judgeTarget, parseLine, ownTestLine, fullRunLine, finale, judgeInstruction, helpersModule }"
    - name: primer
      description: Digest of the tree, git history (Morph-Card trailers) and the run archive for a fresh session; every owned path, most recent first; markdown under a cap with explicit "… N more" lines.
      language: typescript
    - name: scout
      description: Recon session with a cheap model and read-only tools under call/read/char/round budgets; seed from the primer's ownership head; one final answer-only turn after the budget closes; scout.json with provenance and spend.
      language: typescript
    - name: planner
      description: Contour record + map → deck (`plan --spec`), and scout report → one patch card (`plan --from-scout`); judge cards; budget formula; dry run without --add.
      language: typescript
    - name: reviewer
      description: >
        `morph review <base> <head>`: obligations from the record, scope table from a scout report, ownership and envelope from the primer, mutation of new tests, a findings document with EXPECTED/GOT and a source tag.
      language: typescript

Actor:
  - name: Operator
    description: A human or an agent session driving Morph from a shell.
    uses: [morph CLI]

Requirement:
  - name: Strict TypeScript
    description: tsconfig strict, ESM, no `any`; every module compiles with tsc --noEmit.
  - name: One Document Out
    description: Every command prints exactly one JSON document on stdout and nothing else; the human log goes to stderr.
  - name: Deterministic Core
    description: cards, compiler and acceptance give byte-identical results for the same inputs; no clock, no randomness, no environment reads.
  - name: Node Only
    description: Runtime dependencies none beyond Node 20 built-ins; dev dependencies pinned exactly.

Guardrail:
  - name: No Network In Tests
    description: tests/setup.ts makes fetch, XMLHttpRequest, WebSocket and net.connect throw "network blocked in tests"; only the processor's own transport is mocked.
  - name: No Shell Outside Acceptance
    description: child processes are spawned only by Run Acceptance, the git module and the processor's none; everything else is pure.
  - name: Frozen Tree During Run
    description: while a run is in flight no file outside the cards' targets and .morph/ changes; a changed declared input discards the answer unread.
```

## morph-map.json (черновик для P1 `cards`; остальные Component дописываются перед своей фазой)

Решения, которых запись не несёт: имена файлов camelCase через `targets`; группы =
модули; срезы и зависимости перечислены явно (override **заменяет** вычисленное);
`tests/helpers.ts` в срезе каждой карты, пишущей тесты; `docs` — только TASK фазы.
Scaffold (P0) — отдельная одно-карточная колода `decks/p0-scaffold.json`, собираемая
скриптом `decks/p0-tooling/build.py`, не часть map.

```json
{
  "package": "src",
  "docs": ["docs/TASK_P1_cards.md"],
  "groups": {
    "card-model": ["Validate Card", "Load Deck"],
    "layering": ["Layer Generations"],
    "hazards": ["Find Hazards", "Weigh Slices"]
  },
  "cards": {
    "card-model": {
      "targets": ["src/cards/model.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "tests/helpers.ts", "src/types.ts"],
      "depends_on": [],
      "instruction": "Write src/cards/model.ts only: validateCard(input: unknown): {card: Card} | {faults: Fault[]} and loadDeck(text: string): {deck: Deck} | {faults: Fault[]}. Types come from src/types.ts (scaffold). No test file: the judge writes it.",
      "max_tokens": 16000, "variants": 2
    },
    "card-model-judge": {
      "targets": ["tests/cards/model.examples.test.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "src/cards/model.ts", "src/types.ts", "tests/helpers.ts"]
    },
    "layering": {
      "targets": ["src/cards/layer.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "src/cards/model.ts", "src/types.ts", "tests/helpers.ts"],
      "depends_on": ["card-model"],
      "instruction": "Write src/cards/layer.ts only: layerGenerations(deck: Deck): string[][]. No test file.",
      "max_tokens": 12000
    },
    "layering-judge": {
      "targets": ["tests/cards/layer.examples.test.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "src/cards/layer.ts", "src/cards/model.ts", "src/types.ts", "tests/helpers.ts"]
    },
    "hazards": {
      "targets": ["src/cards/hazards.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "src/cards/model.ts", "src/cards/layer.ts", "src/types.ts", "tests/helpers.ts"],
      "depends_on": ["card-model", "layering"],
      "instruction": "Write src/cards/hazards.ts only: findHazards(deck: Deck): Hazard[] and weighSlices(deck: Deck, root: string, cap = 500000): Hazard[]. No test file.",
      "max_tokens": 16000, "variants": 2
    },
    "hazards-judge": {
      "targets": ["tests/cards/hazards.examples.test.ts"],
      "context_slice": ["docs/TASK_P1_cards.md", "src/cards/hazards.ts", "src/cards/model.ts", "src/cards/layer.ts", "src/types.ts", "tests/helpers.ts"]
    }
  }
}
```

Приёмки всех карт переопределяются сборщиком `decks/p1-tooling/build.py` (шаги:
`[ -d node_modules ] || npm ci` → `node_modules/.bin/tsc --noEmit` → `parts/guard.mjs`
(AST: без `any`, без `child_process`/`node:net`/`fetch` вне `src/processor`,
`src/acceptance`, `src/git`) → проба `parts/<card>.probe.ts` (значения **и типы**) →
свой тест → `node_modules/.bin/vitest run --reporter=dot` → frozen → untracked), как в
ETHSmartChecker фазы 16; `instruction` из map — открывающая секция, Function и examples
из записи следуют за ней автоматически.

## Проверка

До гейта оператора, на каждую фазу:

1. Запись валидна сухим планом (ничего не пишет):
   `morph-lab/venv/bin/mrph plan --spec contour.yaml --map morph-map.json --component <C> --judge`
   → exit 0, список карт и поколений совпадает с планом фазы.
2. `mrph deck add --file <колода> && mrph deck check` → `errors: 0`; `oversized-slice`
   нет (срезы — TASK фазы + соседние модули, запись в срез не идёт).
3. Каждая приёмка прогнана руками в scratch worktree (`git worktree add --detach`) с
   однострочными заглушками вместо новых целей: краснеет **по примерам**, читаемой
   строкой, не трейсбеком; время полной приёмки на сухом дереве < 250 с.
4. После прогона: `git status --short` пуст, кроме целей карт; `npm run build`
   (если есть) и `node_modules/.bin/vitest run` зелёные на ветке `morph/<run-id>`;
   отчёт числами: принято / сгорело / пропущено, перегенерации, минуты, $ исполнителя,
   строка про scout (если был), tsc-первый-красный, дефекты, найденные судьёй.
5. Переключатель dogfooding: с фазы, где `morph run` проходит end-to-end на stub-процессоре,
   каждая следующая фаза собирается **и** старым `mrph`, **и** новым `morph` на той же
   колоде, с сравнением отчётов; расхождение — находка.

## Совет автора Contour (переписка 06.10.2026) и два правила записи V2

Автор на 450 КБ `contour.yaml` ETHSmartChecker: «не должен быть таким, если это не
описание всего Microsoft»; вместо файла — собрать `contour-engine`, который хранит
запись и отдаёт её поиском через MCP, «чтоб искать то, что нужно, а не всё в память
брать». Диагноз совпадает с уроком фазы 24 (запись никогда не идёт в срез целиком);
`contour-engine` мы уже построили Морфом 27.09 (`contour-engine-morph`, REST + MCP) —
поднять его как MCP-сервер оркестратора и читать запись запросами вместо grep — отдельный
эксперимент с числами, не зависимость V2.

Два правила записи MorphV2, вытекающие из этого:

1. **Запись не растёт историей.** Прогоны, сгоревшие попытки, уроки фаз — в `.morph/runs`,
   `docs/MEASURE.md` и скилл; `contour.yaml` хранит только текущий контракт.
2. **Большие литералы живут в фикстурах.** Пример ссылается на `tests/fixtures/<файл>`
   через `ref`, а не несёт десятки строк JSON в `then`. Ориентир: Component не больше
   30 КБ записи, иначе это два Component.
