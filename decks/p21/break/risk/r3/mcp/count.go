package mcp

import "morphlite/supervisor"

// Resumed is a file outside the subset that still reads the renamed field Resumes.
func Resumed(l supervisor.Loop) int { return len(l.Resumes) }
