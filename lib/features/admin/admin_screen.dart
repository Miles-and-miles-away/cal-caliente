import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../events/providers.dart';
import 'admin_providers.dart';

/// Typed-phrase confirmation for destructive actions — deliberate friction so
/// a pocket tap can't delete anything. Case-insensitive match.
Future<bool> confirmDestructive(
  BuildContext context, {
  required String title,
  required String phrase,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) {
      var typed = '';
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('This cannot be undone. Type  $phrase  to confirm.'),
              const SizedBox(height: 12),
              TextField(
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                decoration: InputDecoration(
                  hintText: phrase,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => typed = v),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: typed.trim().toUpperCase() == phrase.toUpperCase()
                  ? () => Navigator.pop(context, true)
                  : null,
              child: const Text('Delete'),
            ),
          ],
        ),
      );
    },
  );
  return ok == true;
}

String _tail(String id) => id.substring(id.length - 4).toUpperCase();

class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key});

  void _snack(BuildContext context, String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAdmin = ref.watch(isAdminProvider).value ?? false;
    if (!isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin')),
        body: const Center(child: Text('Admin access required')),
      );
    }

    final stats = ref.watch(adminStatsProvider).value;
    final logs = ref.watch(recentScrapeLogsProvider).value ?? const [];
    final community = ref.watch(communityEventsProvider).value ?? const [];
    final users = ref.watch(adminUsersProvider).value ?? const [];
    final sources = ref.watch(sourcesProvider).value ?? const [];
    final sourceNames = {for (final s in sources) s.id: s.name};
    final firestore = ref.read(firestoreProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Admin')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Usage ──
          Text('Usage', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (stats == null)
            const LinearProgressIndicator()
          else
            Wrap(spacing: 8, runSpacing: 8, children: [
              _StatCard(label: 'Events', value: stats.events),
              _StatCard(label: 'Community', value: stats.communityEvents),
              _StatCard(label: 'Sources', value: stats.sources),
              _StatCard(label: 'Users', value: stats.users),
              _StatCard(label: 'RSVPs', value: stats.rsvps),
            ]),
          const SizedBox(height: 20),

          // ── Scrape health ──
          Row(children: [
            Text('Scrape health',
                style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            TextButton.icon(
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Scrape now'),
              onPressed: () async {
                try {
                  final res = await ref
                      .read(functionsProvider)
                      .httpsCallable('scrapeNow')
                      .call<Map<String, dynamic>>({});
                  if (context.mounted) {
                    _snack(context, 'Scrape done: ${res.data}');
                  }
                } on FirebaseFunctionsException catch (e) {
                  if (context.mounted) {
                    _snack(context, 'Scrape failed: ${e.message}');
                  }
                }
              },
            ),
          ]),
          if (logs.isEmpty)
            const Text('No scrape logs yet')
          else
            for (final log in logs)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  log.status == 'success'
                      ? Icons.check_circle
                      : log.status == 'partial'
                          ? Icons.error_outline
                          : Icons.cancel,
                  color: log.status == 'success'
                      ? Colors.green
                      : log.status == 'partial'
                          ? Colors.orange
                          : Colors.red,
                ),
                title: Text(sourceNames[log.sourceId] ?? log.sourceId),
                subtitle: Text([
                  if (log.createdAt != null)
                    DateFormat('d MMM HH:mm').format(log.createdAt!),
                  'found ${log.eventsFound}, added ${log.eventsAdded}',
                  if (log.errorMessage != null) log.errorMessage!,
                ].join(' · ')),
              ),
          const SizedBox(height: 20),

          // ── Community submissions ──
          Text('Community submissions (${community.length})',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (community.isEmpty)
            const Text('No community submissions')
          else
            for (final e in community)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                onTap: () => context.push('/event/${e.id}'),
                title: Text(
                  e.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: e.isCancelled
                      ? const TextStyle(decoration: TextDecoration.lineThrough)
                      : null,
                ),
                subtitle: Text(
                    '${DateFormat('d MMM').format(e.startAt)} · ${e.city ?? '—'}'
                    '${e.isCancelled ? ' · CANCELLED' : ''}'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(
                    tooltip: e.isCancelled ? 'Un-cancel' : 'Cancel (hide)',
                    icon: Icon(e.isCancelled
                        ? Icons.visibility
                        : Icons.visibility_off),
                    onPressed: () => firestore
                        .collection('events')
                        .doc(e.id)
                        .update({'isCancelled': !e.isCancelled}),
                  ),
                  IconButton(
                    tooltip: 'Delete permanently',
                    icon: const Icon(Icons.delete_forever, color: Colors.red),
                    onPressed: () async {
                      final ok = await confirmDestructive(
                        context,
                        title: 'Delete "${e.title}"?',
                        phrase: 'DELETE ${_tail(e.id)}',
                      );
                      if (ok) {
                        await firestore.collection('events').doc(e.id).delete();
                        if (context.mounted) _snack(context, 'Event deleted');
                      }
                    },
                  ),
                ]),
              ),
          const SizedBox(height: 20),

          // ── Users ──
          Text('Users (${users.length})',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (users.isEmpty)
            const Text('No user docs yet')
          else
            for (final u in users)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person),
                title: Text('…${_tail(u.uid)}'),
                subtitle: Text([
                  '${u.favorites} favorites',
                  if (u.createdAt != null)
                    'since ${DateFormat('d MMM y').format(u.createdAt!)}',
                ].join(' · ')),
                trailing: IconButton(
                  tooltip: 'Delete user + data',
                  icon: const Icon(Icons.person_remove, color: Colors.red),
                  onPressed: () async {
                    final ok = await confirmDestructive(
                      context,
                      title: 'Delete user …${_tail(u.uid)}?',
                      phrase: 'DELETE USER ${_tail(u.uid)}',
                    );
                    if (!ok) return;
                    try {
                      final res = await ref
                          .read(functionsProvider)
                          .httpsCallable('adminDeleteUser')
                          .call<Map<String, dynamic>>({'uid': u.uid});
                      if (context.mounted) {
                        _snack(context,
                            'User deleted (${res.data['deletedRsvps']} RSVPs, ${res.data['deletedSources']} sources)');
                      }
                    } on FirebaseFunctionsException catch (e) {
                      if (context.mounted) {
                        _snack(context, 'Delete failed: ${e.message}');
                      }
                    }
                  },
                ),
              ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: [
        Text('$value', style: Theme.of(context).textTheme.titleLarge),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}
