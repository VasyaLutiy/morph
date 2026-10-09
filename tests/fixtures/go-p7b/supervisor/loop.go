package supervisor

import (
	"errors"

	"morphlite/control"
)

// ErrPhaseMismatch is the error of a phase end that is not the running phase.
var ErrPhaseMismatch = errors.New("phase mismatch")

// Loop is the run state of one project (the API before the re-cut: Resumes, Exited(code, now)).
type Loop struct {
	Phase   control.Phase
	Resumes []int
	Running bool
}

// Exited records an exit of the session at minute now: 0 is done, any other code a resume.
func (l *Loop) Exited(code, now int) []string {
	l.Running = false
	if code == 0 {
		return []string{"done"}
	}
	l.Resumes = append(l.Resumes, now)
	return []string{"resume"}
}
