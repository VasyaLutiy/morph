package supervisor

import (
	"errors"

	"morphlite/control"
)

var ErrPhaseMismatch = errors.New("stub")

type Loop struct {
	Phase    control.Phase
	Restarts []int
	Running  bool
}

func (l *Loop) Exited(code int, stderr string, now int) []string { panic("stub Exited") }
