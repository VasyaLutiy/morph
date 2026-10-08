# TASK_P15L — gocrud: the live check of the Go profile on a small CRUD API (the skeleton of the future Morph Studio backend)

> The operator's narrative (08.10): "A RESTful CRUD API in Go, with every CRUD operation done in a store, for any
> client or mobile app; basic authentication and validation of user input so that stored data stays valid. Aimed at
> the future Morph Studio backend. For now only a basic skeleton, to check P15 golang."
>
> This is issue #6 §3, "a small real project in Go from a record". It is **not** a MorphV2 phase: no card writes
> MorphV2. The project lives in a fresh scratch repository **`/tmp/gocrud`**, its data and deck there. MorphV2 keeps only
> this spec, the MEASURE row and the §11 Actual. It is also **the first phase under the mutation cap** (AUTONOMY, 08.10).

## 1. Why this

P15 proved the Go profile on go-mini: 6 pure functions in 2 packages, 6/6 at the first attempt, $0.0066. A real backend
touches what go-mini does not: `net/http` handlers, JSON decoding with errors, a persistent store with files,
`crypto` hashing, an interface between packages, and one package written by two cards in different generations. Every
acceptance of the Go branch (`go build` + `gofmt -l`, `go vet`, the probe `_*_probe_test.go`, the own package's
`go test`, the full `go test ./...`, the guard by layers) runs here on code that is not arithmetic. The ccledger
greenfield (TypeScript, 27.09: 6/6 cards for $0.09) is the comparison.

Measured: first-attempt rate, retries, fixes, $, minutes of the run, minutes of the preparation, mutants (count,
killed, minutes) against the cap.

## 2. Contract

Module `morphstudio`, `go 1.22`, the standard library only (`go.mod` requires nothing; every acceptance runs with
`GOPROXY=off GOFLAGS=-mod=mod`). Four packages, one directory each at the module root (the profile: the package is the
directory's base name, the code `<pkg>/<name>.go`, the author's test `<pkg>/<name>_test.go`, the judge's
`<pkg>/<name>_examples_test.go`). The helpers are `internal/testhelp` copied byte for byte from
`tests/fixtures/go-mini/internal/testhelp/testhelp.go` (`Equal`, `WriteFile`); scaffold, hand data.

No clock and no randomness in any package: time and ids are injected (`Now func() time.Time`, `NewID func() string`).
No network in a test: handlers are tested with `httptest.NewRecorder` and `httptest.NewRequest`, never a listener.

### 2.1. INPUT data shapes

**project** (pure; imports `strings`, `regexp`, `time`, `unicode/utf8` only)

```go
type Input struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Status      string `json:"status"`
}
type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
```

**HTTP requests** (the api package): `POST /v1/projects` and `PUT /v1/projects/{id}` carry one JSON object of `Input`
with `Content-Type: application/json` (a parameter like `; charset=utf-8` allowed), at most 1 MiB. Unknown keys are an
error. Every `/v1/` request carries `Authorization: Basic base64(user:password)`.

**Users** (the auth package): `type Users map[string]string`, user name → hash string as built by `HashPassword`.
In a test they are a literal; the server's file of users is out of scope (§7).

**The store file** (the store package): one JSON array of `Project`, in `List` order, written whole; a missing file
is an empty store.

### 2.2. OUTPUT data shapes

**Validation** `project.Validate(in Input) (Input, map[string]string)`: returns the normalised input and the field
errors; a valid input gives a **nil** map. Normalisation: `Name` and `Description` trimmed of spaces at both ends;
`Slug` trimmed; `Status` "" → "draft". Rules (lengths in runes, after normalisation), one message per field, the
first that fails:

| field | rule → message |
|---|---|
| name | empty → `required`; > 64 → `too long` |
| slug | empty → `required`; > 40 → `too long`; not `^[a-z0-9]+(-[a-z0-9]+)*$` → `invalid` |
| description | > 500 → `too long` |
| status | not one of `draft`, `active`, `archived` → `invalid` |

`project.New(in Input, id string, now time.Time) Project` builds a Project from a valid input (`CreatedAt` =
`UpdatedAt` = now). `project.Apply(p Project, in Input, now time.Time) Project` replaces the four input fields and
`UpdatedAt`, keeps `ID` and `CreatedAt`.

**Store** (`store`): `var ErrNotFound = errors.New("not found")`, `var ErrSlugTaken = errors.New("slug taken")`;

```go
type Store interface {
	List() ([]project.Project, error)            // sorted by CreatedAt, then ID
	Get(id string) (project.Project, error)      // ErrNotFound
	Create(p project.Project) error              // ErrSlugTaken if another project has p.Slug
	Update(p project.Project) error              // ErrNotFound; ErrSlugTaken if ANOTHER project has p.Slug
	Delete(id string) error                      // ErrNotFound
}
```

`NewMem() *Mem` (in memory, safe for concurrent use with a `sync.Mutex`, returns copies). `OpenFile(path string)
(*File, error)`: loads the file (missing → empty; invalid JSON → an error whose text begins `store: read `); every
successful Create/Update/Delete rewrites the file whole through a temporary file in the same directory and
`os.Rename`; a failed operation leaves the file unchanged.

**Auth** (`auth`): `HashPassword(password, salt string) string` = `"sha256$" + salt + "$" + hex(sha256(salt +
password))`. `Verify(users Users, user, password string) bool`: false for an unknown user or a malformed hash; the
comparison is `crypto/subtle.ConstantTimeCompare`. `Require(users Users, realm string, next http.Handler)
http.Handler`: a missing, non-Basic, undecodable or wrong `Authorization` → status 401, header `WWW-Authenticate:
Basic realm="<realm>"`, `Content-Type: application/json`, body exactly `{"error":{"code":"unauthorized"}}` + "\n";
otherwise `next`.

**HTTP responses** (`api`): every body is JSON with `Content-Type: application/json`, written by `json.Encoder`
(so it ends with "\n"). The error body is `{"error":{"code":"<code>"}}`, for validation
`{"error":{"code":"validation","fields":{"<field>":"<message>",…}}}` (keys sorted, as `encoding/json` writes a map).

| route | success | errors (code, in this order of checks) |
|---|---|---|
| `GET /healthz` (no auth) | 200 `{"status":"ok"}` | — |
| `GET /v1/projects` | 200 `{"items":[…]}` (`[]`, never `null`, when empty) | 401 |
| `POST /v1/projects` | 201, header `Location: /v1/projects/<id>`, body the Project | 401; 415 `unsupported_media_type`; 400 `bad_json` (syntax, unknown key, trailing data, > 1 MiB); 422 `validation`; 409 `slug_taken` |
| `GET /v1/projects/{id}` | 200 the Project | 401; 404 `not_found` |
| `PUT /v1/projects/{id}` | 200 the updated Project | 401; 415; 400; 404 `not_found`; 422; 409 |
| `DELETE /v1/projects/{id}` | 204, empty body | 401; 404 |

A wrong method on a known path is 405 by Go 1.22's `http.ServeMux` (only the status is pinned). Any other store
error → 500 `internal`.

### 2.3. Names

```go
// package api
type Handlers struct {
	Store store.Store
	Now   func() time.Time
	NewID func() string
}
func (h Handlers) List(w http.ResponseWriter, r *http.Request)    // and Create, Get, Update, Delete
func NewRouter(h Handlers, users auth.Users) http.Handler          // realm "morph-studio"
```

Files (the profile's targets): `project/validate.go`, `project/project.go`, `store/mem.go`, `store/file.go`,
`auth/basic.go`, `api/handlers.go`, `api/router.go`. Judges: `<pkg>/<name>_examples_test.go`, one
`func Test<Function>Example<N>` per record example, in example order.

**The cut** (a draft for the record and map; the session sizes it): two Functions of the same package never in one
generation (Go builds the package whole — the P1 lesson in Go form).

| gen | code cards | depends on |
|---|---|---|
| 0 | Validate Input (`project/validate.go`), Basic Auth (`auth/basic.go`) | — |
| 1 | Build Project (`project/project.go`), Memory Store (`store/mem.go`) | Validate Input; Build Project's types* |
| 2 | File Store (`store/file.go`), Project Handlers (`api/handlers.go`) | Memory Store; Build Project, Memory Store |
| 3 | Router (`api/router.go`) | Project Handlers, Basic Auth |

\* If Memory Store needs `Project` in gen 1, `Project` and `Input` move into `project/validate.go` (gen 0), and
Build Project keeps only `New` and `Apply`. The session decides at the record. Seven code cards + seven judges = 14
cards; folding Build Project into Validate Input gives 12.

### 2.4. What must not break

`go.mod`, `internal/testhelp/`, `contour.yaml`, `morph-map.json`, `decks/`: frozen. Nothing in MorphV2 except this
file, `docs/MEASURE.md` (a row "P15L gocrud") and `docs/DECISIONS.md`.

## 3. Acceptance

The Go branch of `morph plan --checks` (P15) unchanged: `go build ./...` + `gofmt -l` → `go vet ./...` → the guard
(`decks/tools/guard.mjs` = `goguard.mjs`, layers in `decks/tools/layers.json`: `project` pure; `store` may import
`os`, `encoding/json`, `sync`, `path/filepath`; `auth` may import `net/http`, `crypto/*`, `encoding/*`; `api` may
import `net/http`, `encoding/json`, `mime`, `errors`; none imports `os/exec`, `net` dialing or the clock) → the probe
`decks/c1/parts/_<card>_probe_test.go` → the own package's `go test` → the full `go test ./...` → frozen → untracked.
Probes check values and types of the record's examples; the HTTP probes use only `httptest.NewRecorder`.

The task is **done** when:
- `morph plan` exit 0, `morph deck check` errors 0, every probe red per example on stubs, mutants **within the cap**
  (≤ 30, ≤ 20 min; survivors beyond it in DECISIONS);
- the run on ds writes every card from **one run** or with fixes of class data only; no file written by hand;
- in `/tmp/gocrud`: `go vet ./...` clean, `gofmt -l .` empty, `go test -count=1 ./...` green;
- an end-to-end check by the operator side (not a card): a 20-line `main` in a scratch copy wires `NewRouter` to
  `OpenFile`, and `curl` does create → list → get → update → delete with Basic auth, plus one 401, one 422, one 409.

## 4. Constraints

Go 1.22, stdlib only, gofmt, go vet; `testhelp.Equal` for every comparison; no `t.Skip`, no network, no clock, no
goroutine left running; a test writes only under `t.TempDir()`; a judge writes only its test file. Card budget sized
from the answer (handlers and their judge are the heaviest: ≥ 16 000 before the ×3).

## 7. Out of scope

`cmd/server` (main, flags, the users file, graceful shutdown) — the operator's e2e wires a throwaway main; a real
database (SQLite/Postgres need a module, and the acceptance forbids the network) — a later task with a vendored
driver; users CRUD, sessions, tokens, roles; pagination, filtering, sorting by request; rate limiting, CORS, TLS;
OpenAPI; Docker and deployment. All of them belong to Morph Studio proper (`~/Documents/Work2026/MorphStudio/PLAN.md`).

## 8. How to run

On the VPS by the session, under AUTONOMY's cycle, in `/tmp/gocrud` instead of `main`:

```
rm -rf /tmp/gocrud && mkdir /tmp/gocrud && cd /tmp/gocrud && git init -q
# scaffold by hand (data): go.mod, internal/testhelp/ (from go-mini), contour.yaml, morph-map.json,
# decks/tools/{guard.mjs=goguard.mjs, firstdiff.mjs=gofirstdiff.mjs, layers.json}, decks/c1/{checks.json, parts/*probe*}
<v2> plan --root . --spec contour.yaml --map morph-map.json --component project --component auth --component store \
     --component api --judge --checks decks/c1/checks.json --out decks/c1/deck.json
<v2> deck check --root . --deck decks/c1/deck.json
python3 ~/MorphV2/decks/tools/scale_tokens.py decks/c1/deck.json 3
<v2> run --root . --deck decks/c1/deck.json --processor ds --deadline 2400
GOFLAGS=-mod=mod GOPROXY=off go vet ./... && test -z "$(gofmt -l .)" && GOFLAGS=-mod=mod GOPROXY=off go test -count=1 ./...
<v2> primer --root . --write
```

`<v2>` is a copy of MorphV2's `dist/` as in `decks/p15/smoke/recipe.sh`. The scratch repo is kept until the operator
side's e2e check; then a tarball of it goes to `decks/p15l/gocrud.tgz` in MorphV2 (no `.morph/runs/*/requests/`).

## 9. Pre-registration

12–14 cards, 4 generations. Expected first reds: a handler judge on the exact JSON bytes (the trailing "\n" of
`json.Encoder`, `[]` vs `null`), a File Store judge on the temp-file rename, the auth judge on the base64 of the header.
Bill: ≤ $0.30 on ds; cap $5.

## 10. What to record

MEASURE row "P15L gocrud": cards written/planned, first-attempt count, retries won, fixes, $, run minutes, preparation
minutes, **mutants: count / killed / minutes / survivors to DECISIONS** (the first capped gate; P15's full campaign is
the baseline), main-session and agent tokens as in P15. §11 below.

## 11. Actual

(filled after the run)
