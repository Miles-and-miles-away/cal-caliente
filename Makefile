# Dev loop — mirrors Seed's Makefile.
JVM := /Users/milesd/miniconda3/envs/seed/lib/jvm
WITH_JAVA := PATH="$(JVM)/bin:$$PATH" JAVA_HOME="$(JVM)"

gen:
	dart run build_runner build

watch:
	dart run build_runner watch

lint:
	flutter analyze

test:
	flutter test

test-rules:
	$(WITH_JAVA) npm run test:rules

# Emulator suite (auth + firestore + functions + UI on :4000).
# Data persists across restarts via .emulator-data (gitignored).
emulators:
	$(WITH_JAVA) npx firebase emulators:start --project demo-cal-caliente \
		$$( [ -d .emulator-data ] && echo --import=.emulator-data ) \
		--export-on-exit=.emulator-data

# Sources + admin user only. Real events come from the scraper
# (Admin -> Scrape now, or the daily schedule).
seed:
	node scripts/seed/seed_emulator.js

# Adds the hand-written demo events — TEST FIXTURES for the integration
# tests (they need deterministic community submissions to delete).
seed-demo:
	node scripts/seed/seed_emulator.js --demo

purge-demo:
	node scripts/seed/seed_emulator.js --purge-demo

run-ios:
	flutter run -d iPhone --dart-define=USE_EMULATOR=true

run-android:
	flutter run -d emulator --dart-define=USE_EMULATOR=true

# Integration smoke on a booted sim/emulator (emulators must be running+seeded).
itest:
	flutter test integration_test/smoke_test.dart -d $(DEVICE) --dart-define=USE_EMULATOR=true

# The Medium_Phone_API_36.1 AVD wedges (system services OOM) when run windowed
# at its default 2GB — boot it headless with 4GB for reliable test runs.
avd:
	~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_36.1 \
		-no-window -no-snapshot -no-boot-anim -no-audio -memory 4096

ci: gen lint test
