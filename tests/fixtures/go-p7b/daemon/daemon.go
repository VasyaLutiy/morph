package daemon

import "morphlite/supervisor"

// Daemon drives the loop of one project.
type Daemon struct{ Loop supervisor.Loop }

// OnExit passes a session exit at minute now to the loop (the code before the re-cut: Exited(code, now)).
func (d *Daemon) OnExit(code, now int) []string { return d.Loop.Exited(code, now) }
