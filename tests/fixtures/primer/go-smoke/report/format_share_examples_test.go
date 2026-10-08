package report

import (
	"testing"

	"mini/internal/testhelp"
)

func TestFormatShareExample1(t *testing.T) {
	got := FormatShare("cpu", 1, 3)
	want := "cpu: 33% (1 of 3)"
	testhelp.Equal(t, "FormatShare example 1", got, want)
}

func TestFormatShareExample2(t *testing.T) {
	got := FormatShare("", 5, 4)
	want := "total: 100% (5 of 4)"
	testhelp.Equal(t, "FormatShare example 2", got, want)
}

func TestFormatShareExample3(t *testing.T) {
	got := FormatShare("disk", 0, 0)
	want := "disk: 0% (0 of 0)"
	testhelp.Equal(t, "FormatShare example 3", got, want)
}
