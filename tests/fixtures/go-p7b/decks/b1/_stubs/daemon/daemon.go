package daemon

import "morphlite/supervisor"

type Daemon struct{ Loop supervisor.Loop }

func (d *Daemon) OnExit(code int, stderr string, now int) []string { panic("stub OnExit") }
