package mcp

import (
	"fmt"

	"morphlite/supervisor"
)

// Mismatch is the tool answer for a phase end that is not running: a file outside every card of the re-cut that
// imports supervisor for a name the record keeps (MorphStudio's mcpserver/session_examples_test.go role).
func Mismatch(phase string) error { return fmt.Errorf("%w: %s", supervisor.ErrPhaseMismatch, phase) }
