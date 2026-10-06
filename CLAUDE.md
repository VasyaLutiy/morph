# MorphV2

Headless-оркестратор пакетной генерации кода на TypeScript. **Весь код здесь пишется
старым Морфом**, не руками и не агентом: запись `contour.yaml` + `morph-map.json` →
`mrph plan --spec --component <C> --judge --add` → `mrph deck check` → гейт оператора →
`mrph run --processor glm53`. Карта кода и карта-судья на каждую Function. План по
эпикам и фазам — `docs/PLAN.md`; замеры — `docs/MEASURE.md`.

- Старый Морф: `/home/john/Documents/Work2026/MorphProject/morph-lab/venv/bin/mrph`
  (ключи процессоров в `morph-lab/.env`, не печатать). Скиллы оркестратора — в
  `morph-lab/.claude/skills/` (ссылки на `mrph/.claude/skills/`).
- Руками (агент) пишутся только данные: запись, map, `docs/TASK_P<N>_*.md`, фикстуры,
  сборщик приёмок `decks/tools/build.py`, пробы `decks/p<N>/parts/*.probe.ts`,
  `package-lock.json` после scaffold. Правка кода руками — нарушение эксперимента.
- Платные прогоны — только по слову оператора; потолок **$5 на фазу** (решение 06.10).
- Перед каждым прогоном: сухой `mrph plan --spec` без `--add`, `deck check` с нулём
  ошибок, каждая приёмка руками в scratch worktree с заглушками.
- Ветки `morph/<run-id>` и мерж в `main` — оператор. Force-push запрещён.
- Артефакты сборки (`.morph/`, `decks/<run-id>.json`) пишет старый Морф; собственные
  артефакты V2 имеют свою схему и живут в тестах во временных каталогах.
- Строитель до P13 — старый `mrph`; с P14 — сам V2 (переключатель dogfooding).
