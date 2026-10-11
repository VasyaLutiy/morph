package supervisor

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestProbePhaseLoopExample1(t *testing.T) {
	l := &Loop{Running: true}
	testhelp.Equal(t, "Exited", l.Exited(0, "", 5), []string{"done"})
	testhelp.Equal(t, "Running, Restarts", []any{l.Running, l.Restarts}, []any{false, []int(nil)})
}
func TestProbePhaseLoopExample2(t *testing.T) {
	l := &Loop{}
	testhelp.Equal(t, "Exited", l.Exited(2, "boom", 9), []string{"restart: boom"})
	testhelp.Equal(t, "Restarts", l.Restarts, []int{9})
}
func TestProbePhaseLoopExample3(t *testing.T) {
	l := &Loop{Restarts: []int{1}}
	testhelp.Equal(t, "Exited", l.Exited(1, "x", 4), []string{"restart: x"})
	testhelp.Equal(t, "Restarts", l.Restarts, []int{1, 4})
	testhelp.Equal(t, "ErrPhaseMismatch", ErrPhaseMismatch.Error(), "phase mismatch")
}
