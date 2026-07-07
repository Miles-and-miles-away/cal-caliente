import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'event_card.dart';
import 'providers.dart';

enum _DateRange { upcoming, thisWeek, thisMonth, pastMonth, all }

const _rangeLabels = {
  _DateRange.upcoming: 'Upcoming',
  _DateRange.thisWeek: 'This Week',
  _DateRange.thisMonth: 'This Month',
  _DateRange.pastMonth: 'Past Month',
  _DateRange.all: 'All',
};

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  String _search = '';
  _DateRange _range = _DateRange.upcoming;

  bool _inRange(DateTime t) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return switch (_range) {
      _DateRange.upcoming =>
        t.isAfter(today) && t.isBefore(today.add(const Duration(days: 60))),
      _DateRange.thisWeek => t.isAfter(today) &&
          t.isBefore(today.add(Duration(days: 8 - now.weekday))),
      _DateRange.thisMonth =>
        t.isAfter(today) && t.month == now.month && t.year == now.year,
      _DateRange.pastMonth =>
        t.isBefore(now) && t.isAfter(now.subtract(const Duration(days: 30))),
      _DateRange.all => true,
    };
  }

  @override
  Widget build(BuildContext context) {
    final all = ref.watch(filteredEventsProvider);
    final q = _search.trim().toLowerCase();
    final results = all
        .where((e) => _inRange(e.startAt))
        .where((e) =>
            q.isEmpty ||
            e.title.toLowerCase().contains(q) ||
            (e.venueName?.toLowerCase().contains(q) ?? false) ||
            (e.organizer?.toLowerCase().contains(q) ?? false) ||
            (e.city?.toLowerCase().contains(q) ?? false))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        actions: [
          IconButton(
            icon: const Icon(Icons.rss_feed),
            tooltip: 'Manage event sources',
            onPressed: () => context.push('/sources'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search events, venues, organizers…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () => setState(() => _search = ''),
                      ),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          const FilterChipsRow(),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final r in _DateRange.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(_rangeLabels[r]!),
                      selected: _range == r,
                      onSelected: (_) => setState(() => _range = r),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('${results.length} events found',
                  style: Theme.of(context).textTheme.bodySmall),
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? const Center(child: Text('No events found'))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: results.length,
                    itemBuilder: (context, i) => EventCard(event: results[i]),
                  ),
          ),
        ],
      ),
    );
  }
}
