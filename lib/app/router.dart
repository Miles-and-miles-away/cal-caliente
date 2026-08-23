import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../features/admin/admin_screen.dart';
import '../features/events/calendar_screen.dart';
import '../features/events/discover_screen.dart';
import '../features/events/providers.dart';
import '../features/events/event_detail_screen.dart';
import '../features/map/map_screen.dart';
import '../features/preferences/preferences_screen.dart';
import '../features/sources/sources_screen.dart';
import '../features/submit/submit_screen.dart';

part 'router.g.dart';

@riverpod
GoRouter router(Ref ref) {
  return GoRouter(
    initialLocation: '/calendar',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/calendar',
              builder: (context, state) => const CalendarScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/discover',
              builder: (context, state) => const DiscoverScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/map',
              builder: (context, state) => const MapScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/preferences',
              builder: (context, state) => const PreferencesScreen(),
            ),
          ]),
        ],
      ),
      GoRoute(
        path: '/event/:id',
        builder: (context, state) =>
            EventDetailScreen(eventId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/submit',
        builder: (context, state) => const SubmitScreen(),
      ),
      GoRoute(
        path: '/sources',
        builder: (context, state) => const SourcesScreen(),
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminScreen(),
      ),
    ],
  );
}

class _MainShell extends ConsumerWidget {
  const _MainShell({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Seed the shared tab filters from saved prefs. Done here (widget-level
    // ref.listen fires outside the build phase) rather than inside the filter
    // Notifiers, which would crash on the Firestore stream emitting mid-frame.
    // Per-field change guards: the user doc emits on every write (a favorite
    // toggle), and unrelated emissions must not clobber transient filter tweaks.
    ref.listen(userPrefsProvider, (prev, prefs) {
      Set<String> setOf(Map<String, dynamic>? p, String k) =>
          List<String>.from((p?[k] as List?) ?? const []).toSet();
      String cityOf(Map<String, dynamic>? p) {
        final c = p?['city'] as String? ?? '';
        return c.isEmpty ? 'all' : c;
      }

      if (!setEquals(setOf(prev, 'danceStyles'), setOf(prefs, 'danceStyles'))) {
        ref
            .read(danceFilterProvider.notifier)
            .setAll(setOf(prefs, 'danceStyles'));
      }
      if (!setEquals(setOf(prev, 'eventTypes'), setOf(prefs, 'eventTypes'))) {
        ref
            .read(eventTypeFilterProvider.notifier)
            .setAll(setOf(prefs, 'eventTypes'));
      }
      if (cityOf(prev) != cityOf(prefs)) {
        ref.read(cityFilterProvider.notifier).set(cityOf(prefs));
      }
    });
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(
          i,
          initialLocation: i == shell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.calendar_month), label: 'Calendar'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Discover'),
          NavigationDestination(icon: Icon(Icons.map), label: 'Map'),
          NavigationDestination(icon: Icon(Icons.tune), label: 'Preferences'),
        ],
      ),
    );
  }
}
