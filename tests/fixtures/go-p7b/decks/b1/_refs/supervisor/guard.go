package supervisor

// MaxPerHour is the default cap.
const MaxPerHour = 3

// Guard reports whether the loop may restart at minute now under the cap max.
func (l *Loop) Guard(now, max int) bool {
	if max <= 0 {
		max = MaxPerHour
	}
	recent := 0
	for _, at := range l.Restarts {
		if at > now-60 && at <= now {
			recent++
		}
	}
	return recent < max
}
