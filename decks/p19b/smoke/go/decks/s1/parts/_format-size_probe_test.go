package size

import (
	"fmt"
	"testing"

	"hsize/internal/testhelp"
)

func probeSize(t *testing.T, n uint64, want string) {
	t.Helper()
	testhelp.Equal(t, fmt.Sprintf("FormatSize(%d)", n), FormatSize(n), want)
}

func TestProbeFormatSizeExample1(t *testing.T) { probeSize(t, 0, "empty") }
func TestProbeFormatSizeExample2(t *testing.T) { probeSize(t, 999, "999 B") }
func TestProbeFormatSizeExample3(t *testing.T) { probeSize(t, 1536, "1.5 kB") }
func TestProbeFormatSizeExample4(t *testing.T) { probeSize(t, 82854982, "83 MB") }

func TestProbeFormatSizeRows(t *testing.T) {
	probeSize(t, 1, "1 B")
	probeSize(t, 1000, "1.0 kB")
	probeSize(t, 1073741824, "1.1 GB")
}
