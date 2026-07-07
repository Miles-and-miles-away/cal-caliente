import 'package:cal_caliente/app/app.dart';
import 'package:cal_caliente/features/admin/admin_screen.dart';
import 'package:cal_caliente/features/events/event_card.dart';
import 'package:cal_caliente/features/preferences/preferences_screen.dart';
import 'package:cal_caliente/firebase_options_demo.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// End-to-end smoke against the Firebase emulator suite (must be running and
/// seeded WITH TEST FIXTURES: `make emulators` + `make seed-demo` — the demo
/// events are deterministic fixtures these tests depend on; normal dev
/// seeding is `make seed`, events come from the real scraper).
/// Run on a device/simulator:
///   flutter test integration_test/smoke_test.dart -d `<device>`
Future<void> pumpUntilFound(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 60), // cold Android AVDs are slow
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for $finder; screen: ${visibleTexts(tester)}');
}

/// Scroll the ListView inside [screen] until [finder] is built and visible.
/// (Lazy lists never mount offscreen children, so find alone can't reach
/// items below the fold.)
Future<void> scrollTo(WidgetTester tester, Finder screen, Finder finder) async {
  // Hand-rolled: scrollUntilVisible needs a single-match target, but ours can
  // match zero (not yet mounted) or several (per-row icons) — both throw.
  final scrollable =
      find.descendant(of: screen, matching: find.byType(Scrollable)).first;
  for (var i = 0; i < 60 && finder.evaluate().isEmpty; i++) {
    await tester.drag(scrollable, const Offset(0, -150), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsWidgets);
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 200));
}

/// Pump until [finder] matches exactly [count] widgets. Mid-rebuild frames
/// briefly report partial counts, so only the exact target ends the wait.
Future<void> pumpUntilStableCount(
  WidgetTester tester,
  Finder finder,
  int count, {
  Duration timeout = const Duration(seconds: 60),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (tester.widgetList(finder).length == count) return;
  }
  fail('Never reached $count× $finder; '
      'now ${tester.widgetList(finder).length}; screen: ${visibleTexts(tester)}');
}

/// Visible Text contents, for failure diagnostics.
String visibleTexts(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((w) => w.data)
    .whereType<String>()
    .take(50)
    .join(' | ');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await Firebase.initializeApp(options: DemoFirebaseOptions.currentPlatform);
    final host = !kIsWeb && defaultTargetPlatform == TargetPlatform.android
        ? '10.0.2.2'
        : 'localhost';
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFunctions.instance.useFunctionsEmulator(host, 5001);
    // Fresh anonymous user every run — the keychain persists the previous
    // one, which would flip RSVP toggle state between runs.
    if (FirebaseAuth.instance.currentUser != null) {
      await FirebaseAuth.instance.signOut();
    }
    await FirebaseAuth.instance.signInAnonymously();
  });

  testWidgets('all tabs + detail + RSVP + save flow', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: CalCalienteApp()));
    await tester.pump();

    // Calendar tab loads with nav bar.
    await pumpUntilFound(tester, find.textContaining('Cal Caliente'));
    expect(find.byType(NavigationBar), findsOneWidget);

    // Discover: seeded events appear.
    await tester.tap(find.text('Discover'));
    await pumpUntilFound(tester, find.byType(EventCard));
    expect(find.byType(EventCard), findsWidgets);

    // Search narrows results (seeded data always has salsa somewhere).
    await tester.enterText(find.byType(TextField).first, 'salsa');
    await tester.pump(const Duration(milliseconds: 400));

    // Clear search, open first event detail.
    await tester.enterText(find.byType(TextField).first, '');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.byType(EventCard).first, warnIfMissed: false);
    await pumpUntilFound(tester, find.text('Save to My Calendar'));

    // RSVP: tap Going, expect the count to increase by exactly 1 (other
    // test-run users may have left RSVPs in the emulator session).
    // Buttons show a bare label until the aggregate count loads.
    await pumpUntilFound(tester, find.textContaining('Going ('));
    await tester.ensureVisible(find.textContaining('Going ('));
    await tester.pump(const Duration(milliseconds: 200));
    final goingText = tester
        .widget<Text>(find.textContaining('Going (').first)
        .data!;
    final before =
        int.parse(RegExp(r'Going \((\d+)\)').firstMatch(goingText)!.group(1)!);
    await tester.tap(find.textContaining('Going ('), warnIfMissed: false);
    try {
      await pumpUntilFound(tester, find.text('Going (${before + 1})'));
    } catch (_) {
      final now = tester
          .widgetList<Text>(find.textContaining('Going ('))
          .map((t) => t.data)
          .toList();
      fail('Going count never became ${before + 1}; buttons show: $now');
    }

    // Save to favorites.
    await tester.ensureVisible(find.text('Save to My Calendar'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('Save to My Calendar'));
    await pumpUntilFound(tester, find.text('Saved to My Calendar'));

    // Back to tabs, check Map renders with OSM layer.
    await tester.pageBack();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Map'));
    await pumpUntilFound(tester, find.byType(FlutterMap));

    // Preferences: pick Tokyo, prefs persist via users/{uid}.
    await tester.tap(find.text('Preferences'));
    await pumpUntilFound(tester, find.text('My Calendar'));
    expect(find.text('1 saved'), findsOneWidget); // the favorite from above
    await tester.tap(find.text('Tokyo').first);
    await tester.pump(const Duration(milliseconds: 600));
    // Anonymous user is not admin: scroll to the list end, no Admin tile.
    // (Scrolling last — it pushes the city chips out of the lazy viewport.)
    await scrollTo(tester, find.byType(PreferencesScreen), find.text('Submit an Event'));
    expect(find.text('Admin'), findsNothing);

    // Calendar: My Calendar toggle shows the saved event badge count.
    await tester.tap(find.text('Calendar'));
    await pumpUntilFound(tester, find.text('All Events'));
    await tester.tap(find.text('All Events'));
    await pumpUntilFound(tester, find.text('My Calendar (1)'));
  });

  testWidgets('admin flow: dashboard + typed-confirm deletes', (tester) async {
    // Runs after the anonymous smoke test, which leaves behind a users doc
    // and an RSVP for adminDeleteUser to clean up. Signs in as the seeded
    // admin (admin@calcaliente.test, admin:true claim) via the debug swap
    // button on the account tile — the same path a developer uses.
    await tester.pumpWidget(const ProviderScope(child: CalCalienteApp()));
    await tester.pump();
    await pumpUntilFound(tester, find.textContaining('Cal Caliente'));

    await tester.tap(find.text('Preferences'));
    await pumpUntilFound(tester, find.byIcon(Icons.swap_horiz));
    await tester.tap(find.byIcon(Icons.swap_horiz));
    await pumpUntilFound(tester, find.text('admin@calcaliente.test'));

    // Admin tile appears in Preferences for admins only (bottom of the list).
    await scrollTo(tester, find.byType(PreferencesScreen), find.text('Admin'));
    await tester.tap(find.text('Admin'), warnIfMissed: false);
    await pumpUntilFound(tester, find.text('Usage'));

    // Wait for ALL stats to load before interacting below them — the async
    // swap from progress bar to stat cards shifts the layout under taps.
    await pumpUntilFound(tester, find.text('RSVPs'));
    expect(find.text('Scrape health'), findsOneWidget);

    // Delete a community submission (seeded, isVerified:false) with the
    // typed phrase. Re-seeding restores deleted demo events between sessions.
    // The community section sits below the (long) scrape-health list — scroll.
    await scrollTo(tester, find.byType(AdminScreen), find.byIcon(Icons.delete_forever));
    final eventDeletes =
        tester.widgetList(find.byIcon(Icons.delete_forever)).length;
    await tester.ensureVisible(find.byIcon(Icons.delete_forever).first);
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byIcon(Icons.delete_forever).first,
        warnIfMissed: false);
    await pumpUntilFound(tester, find.textContaining('cannot be undone'));

    // The Delete button stays disabled until the exact phrase is typed.
    final dialogField = find.byType(TextField).last;
    final phrase =
        tester.widget<TextField>(dialogField).decoration!.hintText!;
    await tester.enterText(dialogField, 'WRONG');
    await tester.pump();
    expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Delete'))
            .onPressed,
        isNull);
    await tester.enterText(dialogField, phrase);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await pumpUntilStableCount(
        tester, find.byIcon(Icons.delete_forever), eventDeletes - 1);

    // Delete the anonymous user left by the smoke test — exercises the
    // adminDeleteUser callable end to end (auth + users doc + RSVP cleanup).
    await scrollTo(tester, find.byType(AdminScreen), find.byIcon(Icons.person_remove));
    final userDeletes =
        tester.widgetList(find.byIcon(Icons.person_remove)).length;
    await tester.ensureVisible(find.byIcon(Icons.person_remove).first);
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byIcon(Icons.person_remove).first,
        warnIfMissed: false);
    await pumpUntilFound(tester, find.textContaining('cannot be undone'));
    final userField = find.byType(TextField).last;
    final userPhrase =
        tester.widget<TextField>(userField).decoration!.hintText!;
    await tester.enterText(userField, userPhrase);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await pumpUntilStableCount(
        tester, find.byIcon(Icons.person_remove), userDeletes - 1);
  });
}
