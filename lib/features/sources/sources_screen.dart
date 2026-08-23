import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants.dart';
import '../admin/admin_providers.dart';
import '../events/providers.dart';

class SourcesScreen extends ConsumerStatefulWidget {
  const SourcesScreen({super.key});

  @override
  ConsumerState<SourcesScreen> createState() => _SourcesScreenState();
}

class _SourcesScreenState extends ConsumerState<SourcesScreen> {
  final _name = TextEditingController();
  final _url = TextEditingController();
  String _type = 'html';
  bool _showAdd = false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final name = _name.text.trim();
    final url = _url.text.trim();
    final uri = Uri.tryParse(url);
    if (name.isEmpty || name.length > 255) {
      _snack('Enter a source name (max 255 chars)');
      return;
    }
    if (uri == null ||
        !(uri.scheme == 'http' || uri.scheme == 'https') ||
        url.length > 768) {
      _snack('Enter a valid http(s) URL (max 768 chars)');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(functionsProvider).httpsCallable('registerSource').call({
        'name': name,
        'url': url,
        'sourceType': _type,
      });
      _name.clear();
      _url.clear();
      setState(() => _showAdd = false);
      _snack('Source added');
    } on FirebaseFunctionsException catch (e) {
      _snack(e.code == 'already-exists'
          ? 'This source is already being tracked'
          : 'Failed: ${e.message}');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final sourcesAsync = ref.watch(sourcesProvider);
    final uid = ref.watch(uidProvider);
    final isAdmin = ref.watch(isAdminProvider).value ?? false;
    final firestore = ref.read(firestoreProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Event Sources'),
        actions: [
          IconButton(
            icon: Icon(_showAdd ? Icons.close : Icons.add),
            onPressed: () => setState(() => _showAdd = !_showAdd),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showAdd)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(children: [
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                      labelText: 'Source name', isDense: true),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _url,
                  decoration: const InputDecoration(
                      labelText: 'URL (https://…)', isDense: true),
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: 8),
                Wrap(spacing: 6, children: [
                  for (final t in sourceTypes)
                    ChoiceChip(
                      label:
                          Text('${sourceTypeIcons[t]} ${sourceTypeLabels[t]}'),
                      selected: _type == t,
                      onSelected: (_) => setState(() => _type = t),
                    ),
                ]),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _busy ? null : _add,
                  child: Text(_busy ? 'Adding…' : 'Add Source'),
                ),
              ]),
            ),
          Expanded(
            child: sourcesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (sources) => ListView.builder(
                itemCount: sources.length,
                itemBuilder: (context, i) {
                  final s = sources[i];
                  final mine = s.addedByUid == uid || isAdmin;
                  return ListTile(
                    leading: Text(sourceTypeIcons[s.sourceType] ?? '🌐',
                        style: const TextStyle(fontSize: 22)),
                    title: Text(s.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${s.url}\n${sourceTypeLabels[s.sourceType]}'
                      '${s.isUserAdded ? " · User added" : " · Default"}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    isThreeLine: true,
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Switch(
                          value: s.isActive,
                          onChanged: mine
                              ? (v) => firestore
                                  .collection('sources')
                                  .doc(s.id)
                                  .update({'isActive': v})
                              : null,
                        ),
                        if (mine && s.isUserAdded)
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () async {
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text('Delete source?'),
                                  content: Text(s.name),
                                  actions: [
                                    TextButton(
                                        onPressed: () =>
                                            Navigator.pop(context, false),
                                        child: const Text('Cancel')),
                                    TextButton(
                                        onPressed: () =>
                                            Navigator.pop(context, true),
                                        child: const Text('Delete')),
                                  ],
                                ),
                              );
                              if (ok == true) {
                                await firestore
                                    .collection('sources')
                                    .doc(s.id)
                                    .delete();
                              }
                            },
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
