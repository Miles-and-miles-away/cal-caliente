import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants.dart';
import '../admin/admin_providers.dart';
import '../events/providers.dart';

class PreferencesScreen extends ConsumerWidget {
  const PreferencesScreen({super.key});

  /// uid changed — recompute everything user-scoped.
  void _invalidateUserScope(WidgetRef ref) {
    ref.invalidate(uidProvider);
    ref.invalidate(userDocProvider);
    ref.invalidate(isAdminProvider);
  }

  void _snack(BuildContext context, String msg) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _googleSignIn(BuildContext context, WidgetRef ref) async {
    final auth = FirebaseAuth.instance;
    final provider = GoogleAuthProvider();
    try {
      // Linking upgrades the anonymous account in place — same uid, so
      // favorites/prefs/RSVPs carry over.
      await auth.currentUser!.linkWithProvider(provider);
      if (context.mounted) {
        _snack(context, 'Signed in — your saved events came along');
      }
    } on FirebaseAuthException catch (e) {
      if (e.code == 'credential-already-in-use' ||
          e.code == 'email-already-in-use' ||
          e.code == 'provider-already-linked') {
        // This Google account already has its own user: switch to it.
        // (The anonymous data stays behind — no merge.)
        try {
          await auth.signInWithProvider(provider);
          if (context.mounted) _snack(context, 'Welcome back');
        } on FirebaseAuthException catch (e2) {
          if (context.mounted) _snack(context, 'Sign-in failed: ${e2.code}');
          return;
        }
      } else if (e.code == 'canceled' || e.code == 'web-context-canceled') {
        return; // user dismissed the flow
      } else {
        if (context.mounted) _snack(context, 'Sign-in failed: ${e.code}');
        return;
      }
    }
    _invalidateUserScope(ref);
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final auth = FirebaseAuth.instance;
    await auth.signOut();
    await auth.signInAnonymously();
    _invalidateUserScope(ref);
  }

  Future<void> _debugSwap(
      BuildContext context, WidgetRef ref, User? user) async {
    final auth = FirebaseAuth.instance;
    try {
      await auth.signOut();
      if (user?.isAnonymous == true) {
        await auth.signInWithEmailAndPassword(
            email: 'admin@calcaliente.test', password: 'admintest123');
      } else {
        await auth.signInAnonymously();
      }
    } on FirebaseAuthException catch (e) {
      if (context.mounted) _snack(context, 'Sign-in failed: ${e.code}');
      await auth.signInAnonymously();
    }
    _invalidateUserScope(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(userPrefsProvider);
    final favorites = ref.watch(favoriteEventIdsProvider);
    final actions = ref.read(actionsProvider);
    final user = FirebaseAuth.instance.currentUser;

    final city = prefs['city'] as String? ?? '';
    final selectedStyles =
        List<String>.from((prefs['danceStyles'] as List?) ?? const []);
    final selectedTypes =
        List<String>.from((prefs['eventTypes'] as List?) ?? const []);
    final theme = prefs['theme'] as String? ?? 'system';

    return Scaffold(
      appBar: AppBar(title: const Text('Preferences')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account
          Card(
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.account_circle),
                title: Text(user?.isAnonymous == true
                    ? 'Anonymous user'
                    : user?.displayName ?? user?.email ?? 'Signed in'),
                subtitle: Text(user?.isAnonymous == true
                    ? 'Sign in to keep your data across devices'
                    : user?.email ?? 'Signed in with Google'),
                // Debug/emulator only: flip between the anonymous user and the
                // seeded admin account (see SCHEMA.md).
                trailing: kDebugMode
                    ? IconButton(
                        tooltip: user?.isAnonymous == true
                            ? 'Sign in as admin (debug)'
                            : 'Back to anonymous',
                        icon: const Icon(Icons.swap_horiz),
                        onPressed: () => _debugSwap(context, ref, user),
                      )
                    : null,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: user?.isAnonymous == true
                    ? FilledButton.tonalIcon(
                        icon: const Icon(Icons.login),
                        label: const Text('Sign in with Google'),
                        onPressed: () => _googleSignIn(context, ref),
                      )
                    : OutlinedButton.icon(
                        icon: const Icon(Icons.logout),
                        label: const Text('Sign out'),
                        onPressed: () => _signOut(context, ref),
                      ),
              ),
            ]),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.bookmark),
              title: const Text('My Calendar'),
              trailing: Text('${favorites.length} saved'),
            ),
          ),
          const SizedBox(height: 16),
          Text('Location', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final c in ['', ...japanCities])
              ChoiceChip(
                label: Text(c.isEmpty ? 'All Cities' : c),
                selected: city == c,
                onSelected: (_) => actions.updatePrefs({'city': c}),
              ),
          ]),
          const SizedBox(height: 16),
          Text('Dance styles (${selectedStyles.isEmpty ? "all" : selectedStyles.length})',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            // Empty selection = all styles; "All Styles" is that default,
            // mirroring the "All Cities" chip above. No separate None.
            FilterChip(
              label: const Text('All Styles'),
              selected: selectedStyles.isEmpty,
              onSelected: (_) => actions.updatePrefs({'danceStyles': <String>[]}),
            ),
            for (final s in danceStyles.where((s) => s != 'other'))
              FilterChip(
                label: Text(danceStyleLabels[s]!),
                selected: selectedStyles.contains(s),
                onSelected: (sel) {
                  final next = [...selectedStyles];
                  sel ? next.add(s) : next.remove(s);
                  actions.updatePrefs({'danceStyles': next});
                },
              ),
          ]),
          const SizedBox(height: 16),
          Text('Event types (${selectedTypes.isEmpty ? "all" : selectedTypes.length})',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            FilterChip(
              label: const Text('All Types'),
              selected: selectedTypes.isEmpty,
              onSelected: (_) => actions.updatePrefs({'eventTypes': <String>[]}),
            ),
            for (final t in eventTypes.where((t) => t != 'other'))
              FilterChip(
                label: Text(eventTypeLabels[t]!),
                selected: selectedTypes.contains(t),
                onSelected: (sel) {
                  final next = [...selectedTypes];
                  sel ? next.add(t) : next.remove(t);
                  actions.updatePrefs({'eventTypes': next});
                },
              ),
          ]),
          const SizedBox(height: 16),
          Text('Language', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'system', label: Text('Auto')),
              ButtonSegment(value: 'en', label: Text('English')),
              ButtonSegment(value: 'ja', label: Text('日本語')),
              ButtonSegment(value: 'es', label: Text('Español')),
            ],
            selected: {prefs['language'] as String? ?? 'system'},
            onSelectionChanged: (sel) => actions.updatePrefs(
                {'language': sel.first == 'system' ? null : sel.first}),
          ),
          const SizedBox(height: 16),
          Text('Theme', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'light', label: Text('Light')),
              ButtonSegment(value: 'system', label: Text('System')),
              ButtonSegment(value: 'dark', label: Text('Dark')),
            ],
            selected: {theme},
            onSelectionChanged: (sel) =>
                actions.updatePrefs({'theme': sel.first}),
          ),
          const SizedBox(height: 24),
          FilledButton.tonalIcon(
            icon: const Icon(Icons.rss_feed),
            label: const Text('Event Sources'),
            onPressed: () => context.push('/sources'),
          ),
          const SizedBox(height: 8),
          FilledButton.tonalIcon(
            icon: const Icon(Icons.add),
            label: const Text('Submit an Event'),
            onPressed: () => context.push('/submit'),
          ),
          if (ref.watch(isAdminProvider).value ?? false) ...[
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              icon: const Icon(Icons.admin_panel_settings),
              label: const Text('Admin'),
              onPressed: () => context.push('/admin'),
            ),
          ],
        ],
      ),
    );
  }
}
