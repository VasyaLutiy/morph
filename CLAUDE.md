# MorphV2

Headless-оркестратор пакетной генерации кода на TypeScript. **Весь код здесь пишется
Морфом**, не руками и не агентом. С P10b1 (07.10) строитель — **сам MorphV2**: запись
`contour.yaml` + `morph-map.json` → `morph plan --spec … --component <C> --judge --out <deck>` →
`morph deck check` → гейт → `morph run --processor glm53` (порядок и флаги — `docs/AUTONOMY.md`,
«The cycle of one phase»). Старый `mrph` — только сухая сверка нарезки и запасной путь. Карта
кода и карта-судья на каждую Function. План по эпикам и фазам — `docs/PLAN.md`; замеры —
`docs/MEASURE.md`.
- Старый Морф: `/home/john/Documents/Work2026/MorphProject/morph-lab/venv/bin/mrph`
  (на VPS — `/home/morph/MorphProject/morph-lab/venv/bin/mrph`; ключи процессоров в
  `morph-lab/.env`, не печатать). `mrph` читает `.env` из текущего каталога: запускать
  из `morph-lab` с `--root <репо>`. Скиллы оркестратора — в `mrph/.claude/skills/`.
- Автономный режим (с P3 на VPS) — по `docs/AUTONOMY.md`; решения по дырам записи —
  в `docs/DECISIONS.md`.
- Спека фазы — по `docs/TASK_TEMPLATE.md` (свой шаблон V2; шаблон mrph заморожен).
- Руками (агент) пишутся только данные: запись, map, `docs/TASK_P<N>_*.md`, фикстуры,
  сборщик приёмок `decks/tools/build.py` (до P10b2, потом в архив), `decks/<phase>/checks.json`, пробы `decks/p<N>/parts/*.probe.ts`,
  `package-lock.json` после scaffold. Правка кода руками — нарушение эксперимента.
- Платные прогоны — только по слову оператора; потолок **$5 на фазу** (решение 06.10).
- Перед каждым прогоном: `morph plan` exit 0, `morph deck check` с нулём ошибок, сухая сверка
  со старым `mrph plan --spec`, каждая приёмка руками в scratch worktree с заглушками.
- Ветки `morph/<run-id>` и мерж в `main` — оператор. Force-push запрещён.
- Артефакты сборки (`.morph/runs/<id>/`, `decks/<phase>/deck.json`) пишет Морф; собственные
  артефакты V2 имеют свою схему и живут в тестах во временных каталогах.
- Строитель P0–P9 — старый `mrph`; P10a — колоду резал mrph, гонял V2; с P10b1 — сам V2.
