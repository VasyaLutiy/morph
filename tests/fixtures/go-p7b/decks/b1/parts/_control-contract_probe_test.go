package control

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestProbeControlContractExample1(t *testing.T) {
	testhelp.Equal(t, "PhaseName", PhaseName("P7", "daemon"), Phase("P7 · daemon"))
}
func TestProbeControlContractExample2(t *testing.T) {
	testhelp.Equal(t, "PhaseName", PhaseName("P10b", ""), Phase("P10b · "))
}
