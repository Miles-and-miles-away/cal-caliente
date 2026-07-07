import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/constants.dart';
import 'event_model.dart';
import 'providers.dart';

class EventCard extends ConsumerWidget {
  const EventCard({super.key, required this.event});
  final Event event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = danceStyleColor(event.danceStyle);
    final favorites = ref.watch(favoriteEventIdsProvider);
    final saved = favorites.contains(event.id);
    final time = event.isAllDay
        ? 'All day'
        : DateFormat('EEE d MMM · HH:mm').format(event.startAt);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/event/${event.id}'),
        child: Row(
          children: [
            Container(width: 5, height: 92, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      _Badge(
                          label: danceStyleLabels[event.danceStyle] ?? 'Other',
                          color: color),
                      const SizedBox(width: 6),
                      _Badge(
                          label: eventTypeLabels[event.eventType] ?? 'Other'),
                      if (event.isVerified) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.verified,
                            size: 16, color: Colors.teal.shade400),
                      ],
                    ]),
                    const SizedBox(height: 4),
                    Text(event.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 2),
                    Text(
                      [
                        time,
                        if (event.venueName != null) event.venueName!,
                        if (event.city != null) event.city!,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
            IconButton(
              icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border,
                  color: saved ? color : null),
              onPressed: () =>
                  ref.read(actionsProvider).toggleFavorite(event.id, !saved),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, this.color});
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: (color ?? Colors.grey).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color ?? Theme.of(context).colorScheme.onSurfaceVariant)),
    );
  }
}

/// Horizontal chip row for the shared dance-style / city filters.
class FilterChipsRow extends ConsumerWidget {
  const FilterChipsRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dance = ref.watch(danceFilterProvider);
    final types = ref.watch(eventTypeFilterProvider);
    final city = ref.watch(cityFilterProvider);
    return Column(children: [
      SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            for (final s in ['all', ...danceStyles])
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilterChip(
                  label: Text(s == 'all' ? 'All' : danceStyleLabels[s]!),
                  selected: s == 'all' ? dance.isEmpty : dance.contains(s),
                  onSelected: (_) => s == 'all'
                      ? ref.read(danceFilterProvider.notifier).clear()
                      : ref.read(danceFilterProvider.notifier).toggle(s),
                ),
              ),
          ],
        ),
      ),
      SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            for (final t in ['all', ...eventTypes])
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilterChip(
                  label: Text(t == 'all' ? 'All Types' : eventTypeLabels[t]!),
                  selected: t == 'all' ? types.isEmpty : types.contains(t),
                  onSelected: (_) => t == 'all'
                      ? ref.read(eventTypeFilterProvider.notifier).clear()
                      : ref.read(eventTypeFilterProvider.notifier).toggle(t),
                ),
              ),
          ],
        ),
      ),
      SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            for (final c in ['all', ...japanCities])
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(c == 'all' ? 'All Cities' : c),
                  selected: city == c,
                  onSelected: (_) =>
                      ref.read(cityFilterProvider.notifier).set(c),
                ),
              ),
          ],
        ),
      ),
    ]);
  }
}
