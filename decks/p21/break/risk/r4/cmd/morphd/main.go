package main

import (
	"fmt"

	"morphlite/daemon"
)

// main is a command outside the subset: it imports daemon, whose only file is a later card's target.
func main() { fmt.Println((&daemon.Daemon{}).Loop.Running) }
