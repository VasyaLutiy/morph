package calc

import (
	"testing"

	"mini/internal/testhelp"
)

func TestPercentOfExample1(t *testing.T) {
	got := PercentOf(1, 3)
	testhelp.Equal(t, "PercentOf(1, 3)", got, 33)
}

func TestPercentOfExample2(t *testing.T) {
	got := PercentOf(2, 3)
	testhelp.Equal(t, "PercentOf(2, 3)", got, 67)
}

func TestPercentOfExample3(t *testing.T) {
	got := PercentOf(1, 8)
	testhelp.Equal(t, "PercentOf(1, 8)", got, 13)
}

func TestPercentOfExample4(t *testing.T) {
	got := PercentOf(5, 4)
	testhelp.Equal(t, "PercentOf(5, 4)", got, 100)
}

func TestPercentOfExample5(t *testing.T) {
	got := PercentOf(3, 0)
	testhelp.Equal(t, "PercentOf(3, 0)", got, 0)

	got = PercentOf(-3, 7)
	testhelp.Equal(t, "PercentOf(-3, 7)", got, 0)
}
