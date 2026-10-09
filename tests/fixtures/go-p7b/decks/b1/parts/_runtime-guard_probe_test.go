package supervisor

import (
	"fmt"
	"testing"

	"morphlite/internal/testhelp"
)

func probeGuard(t *testing.T, restarts []int, now, max int, want bool) {
	t.Helper()
	l := &Loop{Restarts: restarts}
	testhelp.Equal(t, fmt.Sprintf("Guard(%v, %d, %d)", restarts, now, max), l.Guard(now, max), want)
}

func TestProbeRuntimeGuardExample1(t *testing.T) { probeGuard(t, []int{1, 50, 70}, 100, 2, false) }
func TestProbeRuntimeGuardExample2(t *testing.T) { probeGuard(t, []int{1, 50, 70}, 100, 3, true) }
func TestProbeRuntimeGuardExample3(t *testing.T) { probeGuard(t, []int{41, 42, 43}, 101, 0, true) }
func TestProbeRuntimeGuardExample4(t *testing.T) { probeGuard(t, []int{}, 0, 1, true) }
func TestProbeRuntimeGuardRows(t *testing.T) {
	probeGuard(t, []int{50, 60, 70}, 100, -1, false)
	probeGuard(t, []int{10, 200}, 100, 1, true)
	probeGuard(t, []int{40}, 100, 1, true)
}
