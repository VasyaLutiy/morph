package supervisor

// Guard caps the resumes of a Loop per hour (the code before the re-cut: it reads Resumes).
//
// The cap counts the resumes Exited recorded in the 60 minutes up to now;
// reaching the cap stops the loop. A cap of 0 or less is MaxPerHour.

// MaxPerHour is the default cap.
const MaxPerHour = 3

// Guard reports whether the loop may resume at minute now under the cap max.
func (l *Loop) Guard(now, max int) bool {
	if max <= 0 {
		max = MaxPerHour
	}
	recent := 0
	if now < 0 {
		return false
	}
	for _, at := range l.Resumes {
		if at > now-60 && at <= now {
			recent++
		}
	}
	return recent < max
}
