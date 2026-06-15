package db

import "context"

// EnsureSchema previously bootstrapped tables and columns that pre-dated the
// migrations/ directory. Everything has been moved into numbered migration
// files (001–027). This function is now a no-op and can be removed once all
// call sites are cleaned up.
func EnsureSchema(_ context.Context) {}
