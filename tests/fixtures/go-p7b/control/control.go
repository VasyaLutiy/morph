package control

// Phase is the name of a project phase.
type Phase string

// PhaseName is the phase id and its title joined by ": " (the code before the re-cut).
func PhaseName(id, title string) Phase { return Phase(id + ": " + title) }
