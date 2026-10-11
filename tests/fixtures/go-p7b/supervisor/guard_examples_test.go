package supervisor

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestRuntimeGuardExample1(t *testing.T) {
	l := &Loop{}
	l.Exited(4, 15)
	testhelp.Equal(t, "Guard", l.Guard(20, 1), false)
}
