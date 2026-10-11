package control

// Phase is the name of a project phase.
type Phase string

// PhaseName is the phase id and its title joined by " · ".
func PhaseName(id, title string) Phase { return Phase(id + " · " + title) }
