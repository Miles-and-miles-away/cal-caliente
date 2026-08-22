# Dev loop for the Flutter app, Firebase emulators, and test suites.

.PHONY: gen watch lint test test-rules emulators seed seed-demo purge-demo \
        run-ios run-android itest avd ci check-java

# Java for the Firestore emulator. Uses JAVA_HOME if set, else macOS
# java_home. Override: make emulators JAVA_HOME=/path/to/jdk
# `ifeq` not `?=`: make imports env vars with origin `environment`, so `?=`
# would not fire for an exported-but-empty JAVA_HOME.
ifeq ($(strip $(JAVA_HOME)),)
JAVA_HOME := $(shell /usr/libexec/java_home 2>/dev/null)
endif
WITH_JAVA := $(if $(strip $(JAVA_HOME)),PATH="$(JAVA_HOME)/bin:$$PATH" JAVA_HOME="$(JAVA_HOME)",)

# macOS ships /usr/bin/java as a stub that exits 0 for `command -v` but fails
# on use, so the probe has to actually start a JVM.
check-java:
	@java -version >/dev/null 2>&1 || { \
	  echo "No working JDK found. Install one (brew install --cask temurin)"; \
	  echo "or set JAVA_HOME=/path/to/jdk."; \
	  exit 1; }

gen:
	dart run build_runner build

watch:
	dart run build_runner watch

lint:
	flutter analyze

test:
	flutter test

test-rules: check-java
	$(WITH_JAVA) npm run test:rules

# Emulator suite (auth + firestore + functions + UI on :4000).
# Data persists across restarts via .emulator-data (gitignored).
emulators: check-java
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

# ADMIN_PASSWORD enables the debug admin-swap button; must match the
# SEED_ADMIN_PASSWORD used for `make seed`.
DEFINES := --dart-define=USE_EMULATOR=true \
	--dart-define=ADMIN_PASSWORD=$(SEED_ADMIN_PASSWORD)

run-ios:
	flutter run -d iPhone $(DEFINES)

run-android:
	flutter run -d emulator $(DEFINES)

# Integration smoke on a booted sim/emulator (emulators must be running+seeded).
itest:
	flutter test integration_test/smoke_test.dart -d $(DEVICE) $(DEFINES)

# AVDs wedge (system services OOM) when run windowed at the default 2GB —
# boot headless with 4GB for reliable test runs. Override: make avd AVD=<name>
AVD ?= Medium_Phone_API_36.1
avd:
	~/Library/Android/sdk/emulator/emulator -avd $(AVD) \
		-no-window -no-snapshot -no-boot-anim -no-audio -memory 4096

ci: gen lint test
