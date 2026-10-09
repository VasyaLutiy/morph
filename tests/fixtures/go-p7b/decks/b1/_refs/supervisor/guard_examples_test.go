package supervisor

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestRuntimeGuardExample1(t *testing.T) {
	testhelp.Equal(t, "Guard", (&Loop{Restarts: []int{1, 50, 70}}).Guard(100, 2), false)
}

func TestRuntimeGuardExample2(t *testing.T) {
	testhelp.Equal(t, "Guard", (&Loop{Restarts: []int{1, 50, 70}}).Guard(100, 3), true)
}

func TestRuntimeGuardExample3(t *testing.T) {
	testhelp.Equal(t, "Guard", (&Loop{Restarts: []int{41, 42, 43}}).Guard(101, 0), true)
}

func TestRuntimeGuardExample4(t *testing.T) {
	testhelp.Equal(t, "Guard", (&Loop{}).Guard(0, 1), true)
}
