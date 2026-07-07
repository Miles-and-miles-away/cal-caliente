import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants.dart';
import 'event_model.dart';
import 'providers.dart';

/// Address as the event provided it — for navigation this beats our
/// (possibly city-approximated) coordinates. Coords are the fallback.
String _addressText(Event e) =>
    [e.venueName, e.venueAddress, e.city].whereType<String>().join(', ');

/// The event's source link is attacker-controllable (any user can submit or
/// register a source), so it's the one outbound URL we don't fully trust.
/// Show where it goes and let the user bail before we hand off to the browser.
Future<void> _openSourceUrl(BuildContext context, Uri uri) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Open external link?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('This opens a site outside the app:'),
          const SizedBox(height: 8),
          Text(uri.host,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(uri.toString(),
              style: Theme.of(ctx).textTheme.bodySmall,
              maxLines: 3,
              overflow: TextOverflow.ellipsis),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel')),
        FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Open')),
      ],
    ),
  );
  if (confirmed == true) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

Future<void> _openGoogleMaps(Event e) async {
  final address = _addressText(e);
  final query = address.isNotEmpty
      ? Uri.encodeComponent(address)
      : (e.hasCoords ? '${e.latitude},${e.longitude}' : null);
  if (query == null) return;
  await launchUrl(
    Uri.parse('https://www.google.com/maps/search/?api=1&query=$query'),
    mode: LaunchMode.externalApplication,
  );
}

class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventAsync = ref.watch(eventByIdProvider(eventId));

    return eventAsync.when(
      loading: () => const Scaffold(
          body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
          appBar: AppBar(), body: Center(child: Text('Error: $e'))),
      data: (event) {
        if (event == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Event not found')),
          );
        }
        return _EventDetail(event: event);
      },
    );
  }
}

class _EventDetail extends ConsumerWidget {
  const _EventDetail({required this.event});
  final Event event;

  void _showVenueActions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.copy),
            title: const Text('Copy address'),
            onTap: () async {
              await Clipboard.setData(ClipboardData(text: _addressText(event)));
              if (sheet.mounted) Navigator.pop(sheet);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Address copied')));
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.map_outlined),
            title: const Text('Open in Google Maps'),
            onTap: () {
              Navigator.pop(sheet);
              _openGoogleMaps(event);
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = danceStyleColor(event.danceStyle);
    final favorites = ref.watch(favoriteEventIdsProvider);
    final saved = favorites.contains(event.id);
    final myStatus = ref.watch(myAttendanceProvider(event.id)).value;
    final counts = ref.watch(attendanceCountsProvider(event.id)).value;
    final actions = ref.read(actionsProvider);

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
            onPressed: () => actions.toggleFavorite(event.id, !saved),
          ),
        ],
      ),
      body: ListView(
        children: [
          Container(height: 6, color: color),
          if (event.imageUrl != null)
            Image.network(event.imageUrl!,
                height: 200,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(spacing: 6, runSpacing: 6, children: [
                  Chip(
                    label: Text(danceStyleLabels[event.danceStyle] ?? 'Other'),
                    backgroundColor: color.withValues(alpha: 0.15),
                    labelStyle: TextStyle(color: color),
                  ),
                  Chip(label: Text(eventTypeLabels[event.eventType] ?? 'Other')),
                  if (event.isVerified)
                    const Chip(
                      avatar: Icon(Icons.verified, size: 16),
                      label: Text('Verified'),
                    )
                  else
                    const Chip(label: Text('Community submission')),
                ]),
                const SizedBox(height: 8),
                Text(event.title,
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 16),
                _InfoRow(
                  icon: Icons.event,
                  title: DateFormat('EEEE, d MMMM y').format(event.startAt),
                  subtitle: event.isAllDay
                      ? 'All day'
                      : [
                          DateFormat('HH:mm').format(event.startAt),
                          if (event.endAt != null)
                            DateFormat('HH:mm').format(event.endAt!),
                        ].join(' – '),
                ),
                if (event.venueName != null || event.venueAddress != null)
                  _InfoRow(
                    icon: Icons.place,
                    title: event.venueName ?? 'Venue',
                    subtitle: [
                      if (event.venueAddress != null) event.venueAddress!,
                      'Tap: show on map · Hold: copy / Google Maps',
                    ].join('\n'),
                    onTap: () {
                      ref.read(mapFocusProvider.notifier).set(event.id);
                      context.go('/map');
                    },
                    onLongPress: () => _showVenueActions(context, ref),
                  ),
                if (event.nearestStation != null)
                  _InfoRow(
                      icon: Icons.train,
                      title: 'Nearest station',
                      subtitle: event.nearestStation!),
                if (event.city != null)
                  _InfoRow(
                      icon: Icons.location_city,
                      title: 'City',
                      subtitle: event.city!),
                if (event.price != null)
                  _InfoRow(
                      icon: Icons.payments,
                      title: 'Price',
                      subtitle: event.price!),
                if (event.organizer != null)
                  _InfoRow(
                      icon: Icons.person,
                      title: 'Organizer',
                      subtitle: event.organizer!),
                if (event.description != null) ...[
                  const SizedBox(height: 8),
                  Text(event.description!,
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  style: saved
                      ? FilledButton.styleFrom(backgroundColor: color)
                      : null,
                  icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
                  label: Text(saved ? 'Saved to My Calendar' : 'Save to My Calendar'),
                  onPressed: () => actions.toggleFavorite(event.id, !saved),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: _RsvpButton(
                      label: 'Interested',
                      count: counts?.interested,
                      selected: myStatus == 'interested',
                      onTap: () => actions.setAttendance(event.id,
                          myStatus == 'interested' ? null : 'interested'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _RsvpButton(
                      label: 'Going',
                      count: counts?.going,
                      selected: myStatus == 'going',
                      onTap: () => actions.setAttendance(
                          event.id, myStatus == 'going' ? null : 'going'),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                if (event.sourceUrl != null &&
                    Uri.tryParse(event.sourceUrl!)?.scheme.startsWith('http') ==
                        true)
                  TextButton.icon(
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('View Original Source'),
                    onPressed: () =>
                        _openSourceUrl(context, Uri.parse(event.sourceUrl!)),
                  ),
                TextButton.icon(
                  icon: const Icon(Icons.travel_explore),
                  label: const Text('Search the Web'),
                  onPressed: () {
                    final q = Uri.encodeComponent([
                      event.title,
                      if (event.venueName != null) event.venueName!,
                      if (event.city != null) event.city!,
                    ].join(' '));
                    launchUrl(Uri.parse('https://duckduckgo.com/?q=$q'),
                        mode: LaunchMode.externalApplication);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(
      {required this.icon,
      required this.title,
      required this.subtitle,
      this.onTap,
      this.onLongPress});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      onTap: onTap,
      onLongPress: onLongPress,
    );
  }
}

class _RsvpButton extends StatelessWidget {
  const _RsvpButton(
      {required this.label,
      required this.count,
      required this.selected,
      required this.onTap});
  final String label;
  final int? count; // null while the aggregate query is loading
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = count == null ? label : '$label ($count)';
    return selected
        ? FilledButton(onPressed: onTap, child: Text(text))
        : OutlinedButton(onPressed: onTap, child: Text(text));
  }
}
