package daemon

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestDaemonCoreExample1(t *testing.T) {
	d := &Daemon{}
	testhelp.Equal(t, "OnExit", d.OnExit(0, "", 1), []string{"done"})
}

func TestDaemonCoreExample2(t *testing.T) {
	d := &Daemon{}
	testhelp.Equal(t, "OnExit", d.OnExit(3, "oom", 7), []string{"restart: oom"})
	testhelp.Equal(t, "Restarts", d.Loop.Restarts, []int{7})
}
