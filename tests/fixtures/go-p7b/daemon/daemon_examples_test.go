package daemon

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestDaemonCoreExample1(t *testing.T) {
	d := &Daemon{}
	testhelp.Equal(t, "OnExit", d.OnExit(1, 3), []string{"resume"})
}
