package a

import "example.com/vq/b"

// A calls the old API.
func A() int { return b.Old() }
