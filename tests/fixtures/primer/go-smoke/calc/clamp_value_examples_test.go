package calc

import (
	"testing"

	"mini/internal/testhelp"
)

func TestClampValueExample1(t *testing.T) {
	got := ClampValue(5, 0, 3)
	testhelp.Equal(t, "ClampValue(5, 0, 3)", got, 3)
}

func TestClampValueExample2(t *testing.T) {
	got := ClampValue(-2, -1, 4)
	testhelp.Equal(t, "ClampValue(-2, -1, 4)", got, -1)
}

func TestClampValueExample3(t *testing.T) {
	got := ClampValue(7, 9, 2)
	testhelp.Equal(t, "ClampValue(7, 9, 2)", got, 7)
}

func TestClampValueExample4(t *testing.T) {
	got := ClampValue(12, 9, 2)
	testhelp.Equal(t, "ClampValue(12, 9, 2)", got, 9)
}
