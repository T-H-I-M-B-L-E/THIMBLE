.PHONY: install-hooks test

install-hooks:
	git config core.hooksPath .githooks
	@echo "✓ git hooks installed — tests will run before every push"

test:
	cd backend && go test ./...
	pnpm test --passWithNoTests
