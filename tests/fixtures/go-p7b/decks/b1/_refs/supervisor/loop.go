package supervisor

import (
	"errors"

	"morphlite/control"
)

// ErrPhaseMismatch is the error of a phase end that is not the running phase.
var ErrPhaseMismatch = errors.New("phase mismatch")

// Loop is the run state of one project.
type Loop struct {
	Phase    control.Phase
	Restarts []int
	Running  bool
}

// Exited records an exit of the session at minute now: 0 is done, any other code a restart.
func (l *Loop) Exited(code int, stderr string, now int) []string {
	l.Running = false
	if code == 0 {
		return []string{"done"}
	}
	l.Restarts = append(l.Restarts, now)
	return []string{"restart: " + stderr}
}
