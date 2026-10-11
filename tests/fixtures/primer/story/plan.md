# План (выдержка)

### Фазы (первый план)

| фаза | Component | Function | карт / рёбра | оракул и фикстуры | руками | $ | риск → лечение |
|---|---|---|---|---|---|---|---|
| **P12** | contour | parseContour (yaml → типизированная запись), validateContour (behavior+examples обязательны, union литеральные, неизвестные ключи отвергаются), readMap (version 1, language, docs, groups, cards, extra_cards), selectComponents (`--component*`, граф calls) | 8; validate/select → parse | `fixtures/contour/mini.yaml` (2 Component, 4 Function) + `mini.map.json`; строки ошибок литералом | — | 0.8 | рыхлые формы yaml → литеральные union с примерами ошибок |

## Фазы по записи (после P2, 06.10)

| фаза | Component записи | что добавляет | веха |
|---|---|---|---|
| P10b1 | builder | сборщик приёмок на TS (#3 A1–A10, B1–B2): снимок, tsconfig карты, порядок стадий, guard, пробы, имена, исключения, frozen, own-git; файл checks фазы; золотая сверка на колоде P10a | **первая колода, нарезанная V2** |
| P10b2 | cli (+ builder) | `morph plan --checks`: чтение checks, guard, локатора и проб; checks на фазу; сквозная золотая сверка; скелет судьи | build.py в архив |
| P10c | runloop + compiler + git (runner) | паритет бегунка, issue #3 C2–C7: бюджет повторов на карту (не на прогон; `--max-retry-batches 8` уходит), контекст повтора от варианта, дошедшего дальше всех, сырые ответы и сообщения запроса в `.morph/runs/<id>/answers/` + строка stderr на вариант, срез в `<file_contents path=…>` вместо блоков кода, свой таймаут приёмки 300 с, текст обрезанного ответа как у старого | после smoke P10b2; метка `P10c-runner` |
| P11 | processor (batch) | `/api/beta/batches`, submit/collect | **первая фаза, собранная V2** после переключения |
| P11b | processor + runloop + git + cli (batch) | P11b1: архив по решению оператора (ответы в git, копии запросов gzip в `requests/` под .gitignore), стоимость и id батча в отчёте, `.morph/batches/<id>.json`, ожидание батча 1 ч, отмена брошенного батча, дедлайн перед каждым повтором (issue #4); P11b2: `morph submit` / `morph collect` | P11b1 — первая фаза на процессоре ds (07.10) |
| P11c | runloop + acceptance + cli + git + cards (runner hardening) | ревью кода 07.10, issue #5 (метка `P11c-runner`): архив при брошенной ошибке, разблокировка зависимых после позднего повтора, ключи не попадают в env приёмки (обязательны HIGH 1–2 и утечка ключа 5), сигналы, id `.r<n>`, null acceptance, дифф O(n·m), `..` и пустая колода | перед P12, который читает архивы; P11b2 после P11c |
| P12a | primer + cli | issue #1: архивы V2 и mrph с итогами, хронология фаз из MEASURE (столбец «прогоны»), «что дальше» из PLAN и AUTONOMY, хвост DECISIONS и issues из файла, тесты по профилю языка; `morph primer [--write]` | **smoke stop** после P12a (эксперимент #1 — оператор) |
| P12b | primer | владение по трейлерам (`%(trailers)`): путь → карты, модель, прогон; секция ownership для seed scout | перед P13a (seed из головы владения) |
| P13a | scout | протокол READ/GREP/LIST/ANSWER, клетка путей (realpath, symlink), бюджеты → stop_reason, seed из primer | разделено заранее (в старом плане две фазы) |
| P14 | reviewer | obligations, envelope, guardrails, findings | последняя |

Итого (07.10): P0–P14 с подфазами P1b, P9b, P9c, P10a, P10b1, P10b2, P10c, P13a, P13b; после P10b1 остаются P10b2, P10c, P11, P11b, P11c, P12, P13a, P13b, P14 (P11c добавлена оператором 07.10). Оценка по P1–P2: ≈$0.1–0.2 исполнителя на фазу
