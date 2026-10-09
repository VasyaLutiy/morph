package control

import (
	"testing"

	"morphlite/internal/testhelp"
)

func TestControlContractExample1(t *testing.T) {
	testhelp.Equal(t, "PhaseName", PhaseName("P7", "daemon"), Phase("P7: daemon"))
}
