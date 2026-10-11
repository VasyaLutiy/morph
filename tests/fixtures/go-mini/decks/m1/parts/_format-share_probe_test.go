package report

import (
	"fmt"
	"testing"

	"mini/internal/testhelp"
)

func probeShare(t *testing.T, label string, part, whole int, want string) {
	t.Helper()
	testhelp.Equal(t, fmt.Sprintf("FormatShare(%q, %d, %d)", label, part, whole), FormatShare(label, part, whole), want)
}

func TestProbeFormatShareExample1(t *testing.T) { probeShare(t, "cpu", 1, 3, "cpu: 33% (1 of 3)") }
func TestProbeFormatShareExample2(t *testing.T) { probeShare(t, "", 5, 4, "total: 100% (5 of 4)") }
func TestProbeFormatShareExample3(t *testing.T) { probeShare(t, "disk", 0, 0, "disk: 0% (0 of 0)") }

func TestProbeFormatShareRows(t *testing.T) {
	probeShare(t, "", 0, 0, "total: 0% (0 of 0)")
	probeShare(t, "io", -3, 7, "io: 0% (-3 of 7)")
	probeShare(t, "x y", 2, 3, "x y: 67% (2 of 3)")
	probeShare(t, "net", 1, 8, "net: 13% (1 of 8)")
}
