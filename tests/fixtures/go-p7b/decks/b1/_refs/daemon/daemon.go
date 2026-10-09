package daemon

import "morphlite/supervisor"

// Daemon drives the loop of one project.
type Daemon struct{ Loop supervisor.Loop }

// OnExit passes a session exit at minute now to the loop.
func (d *Daemon) OnExit(code int, stderr string, now int) []string {
	return d.Loop.Exited(code, stderr, now)
}
