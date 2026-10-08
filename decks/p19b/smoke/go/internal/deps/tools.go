//go:build tools

// Package deps names every module the record declares, so that `go mod vendor` (which ignores build tags) vendors
// their packages before any card imports them. It is never built.
package deps

import _ "github.com/dustin/go-humanize"
