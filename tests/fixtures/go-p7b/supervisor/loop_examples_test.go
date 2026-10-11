package supervisor

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestPhaseLoopExample1(t *testing.T) {
	l := &Loop{Running: true}
	testhelp.Equal(t, "Exited", l.Exited(1, 5), []string{"resume"})
	testhelp.Equal(t, "Resumes", l.Resumes, []int{5})
}
