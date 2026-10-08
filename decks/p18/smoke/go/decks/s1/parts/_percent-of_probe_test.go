package calc

import (
	"fmt"
	"testing"

	"mini/internal/testhelp"
)

func probePercent(t *testing.T, part, whole, want int) {
	t.Helper()
	testhelp.Equal(t, fmt.Sprintf("PercentOf(%d, %d)", part, whole), PercentOf(part, whole), want)
}

func TestProbePercentOfExample1(t *testing.T) { probePercent(t, 1, 3, 33) }
func TestProbePercentOfExample2(t *testing.T) { probePercent(t, 2, 3, 67) }
func TestProbePercentOfExample3(t *testing.T) { probePercent(t, 1, 8, 13) }
func TestProbePercentOfExample4(t *testing.T) { probePercent(t, 5, 4, 100) }
func TestProbePercentOfExample5(t *testing.T) {
	probePercent(t, 3, 0, 0)
	probePercent(t, -3, 7, 0)
}

func TestProbePercentOfRows(t *testing.T) {
	probePercent(t, 0, 5, 0)
	probePercent(t, 1, 2, 50)
	probePercent(t, 1, 200, 1)
	probePercent(t, 1, 201, 0)
	probePercent(t, 99, 100, 99)
	probePercent(t, 100, 100, 100)
	probePercent(t, 3, -4, 0)
	probePercent(t, 2, 7, 29)
	probePercent(t, 7, 7, 100)
	probePercent(t, 1, 1, 100)
}
