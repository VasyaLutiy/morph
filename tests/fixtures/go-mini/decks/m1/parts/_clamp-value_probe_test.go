package calc

import (
	"fmt"
	"testing"

	"mini/internal/testhelp"
)

func probeClamp(t *testing.T, v, lo, hi, want int) {
	t.Helper()
	testhelp.Equal(t, fmt.Sprintf("ClampValue(%d, %d, %d)", v, lo, hi), ClampValue(v, lo, hi), want)
}

func TestProbeClampValueExample1(t *testing.T) { probeClamp(t, 5, 0, 3, 3) }
func TestProbeClampValueExample2(t *testing.T) { probeClamp(t, -2, -1, 4, -1) }
func TestProbeClampValueExample3(t *testing.T) { probeClamp(t, 7, 9, 2, 7) }
func TestProbeClampValueExample4(t *testing.T) { probeClamp(t, 12, 9, 2, 9) }

func TestProbeClampValueRows(t *testing.T) {
	probeClamp(t, 1, 9, 2, 2)
	probeClamp(t, 4, 4, 4, 4)
	probeClamp(t, -8, -5, -5, -5)
	probeClamp(t, 3, 1, 6, 3)
	probeClamp(t, 6, 1, 6, 6)
	probeClamp(t, 1, 1, 6, 1)
	probeClamp(t, 2, 6, 1, 2)
}
