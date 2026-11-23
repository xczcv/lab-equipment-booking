.PHONY: check hooks test mutation

check:
	npm run check

hooks:
	sh scripts/install-hooks.sh

test:
	npm run build
	sh scripts/with-postgres.sh node --test test/health.test.js test/unit/*.test.js test/postgres-contract.test.js test/booking-race.test.js test/booking.e2e.test.js

mutation:
	npx --no-install stryker run
