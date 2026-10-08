package word

import (
	"fmt"
	"testing"

	"hsize/internal/testhelp"
)

func probeWord(t *testing.T, n int, noun, want string) {
	t.Helper()
	testhelp.Equal(t, fmt.Sprintf("PluralWord(%d, %q)", n, noun), PluralWord(n, noun), want)
}

func TestProbePluralWordExample1(t *testing.T) { probeWord(t, 1, "file", "1 file") }
func TestProbePluralWordExample2(t *testing.T) { probeWord(t, 0, "dir", "0 dirs") }
func TestProbePluralWordExample3(t *testing.T) { probeWord(t, 12, "byte", "12 bytes") }
func TestProbePluralWordExample4(t *testing.T) { probeWord(t, -1, "step", "-1 step") }

func TestProbePluralWordRows(t *testing.T) {
	probeWord(t, 2, "card", "2 cards")
	probeWord(t, -3, "day", "-3 days")
}
