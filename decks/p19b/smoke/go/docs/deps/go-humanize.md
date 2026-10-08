# github.com/dustin/go-humanize v1.0.1 — API digest (Go)

Declared in `contour.yaml` (`System.dependencies`) and used by Component `size` only. Written from the module's own
`README.markdown` and the doc comments of `bytes.go`, `comma.go` and `ordinals.go` at v1.0.1; every value below was run
on v1.0.1 (go 1.22, `GOFLAGS=-mod=vendor GOPROXY=off`). The module has no dependencies of its own. It is vendored under
`vendor/github.com/dustin/go-humanize/`; never fetch it.

## Import

```go
import humanize "github.com/dustin/go-humanize"   // package name humanize; the alias only makes it explicit
```

## Signatures (sizes)

```go
// Bytes produces a human readable representation of an SI size (base 1000: B, kB, MB, GB, TB, PB, EB).
func Bytes(s uint64) string
// IBytes produces a human readable representation of an IEC size (base 1024: B, KiB, MiB, GiB, ...).
func IBytes(s uint64) string
// ParseBytes parses a string representation of bytes into the number of bytes it represents
// ("42 MB" → 42000000, "42 MiB" → 44040192); an unparsable text returns 0 and an error.
func ParseBytes(s string) (uint64, error)
```

Below 10 units a value keeps one decimal ("1.5 kB", "1.0 kB"); from 10 on it is rounded to a whole number ("83 MB").
Below 1000 bytes it is the plain count with " B" ("999 B", "0 B").

## Other functions in the package (not needed by the record)

```go
func Comma(v int64) string        // 1234567 → "1,234,567"; -1000 → "-1,000"
func Ordinal(x int) string        // 1 → "1st"; 12 → "12th"; 23 → "23rd"
func Time(then time.Time) string  // relative to time.Now(): reads the clock, never use it in a pure package
```

## Values (measured, v1.0.1)

```text
Bytes(0)          → "0 B"        IBytes(0)          → "0 B"
Bytes(999)        → "999 B"      IBytes(999)        → "999 B"
Bytes(1000)       → "1.0 kB"     IBytes(1000)       → "1000 B"
Bytes(1536)       → "1.5 kB"     IBytes(1536)       → "1.5 KiB"
Bytes(82854982)   → "83 MB"      IBytes(82854982)   → "79 MiB"
Bytes(1073741824) → "1.1 GB"     IBytes(1073741824) → "1.0 GiB"
ParseBytes("1.5kB") → 1500, nil
ParseBytes("x")     → 0, `strconv.ParseFloat: parsing "": invalid syntax`
```

## One example

```go
package size

import humanize "github.com/dustin/go-humanize"

// Describe returns "<name>: <size>", the size in SI units.
func Describe(name string, n uint64) string {
	return name + ": " + humanize.Bytes(n) // Describe("a.bin", 82854982) == "a.bin: 83 MB"
}
```
