import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../core/constants.dart';
import '../events/event_card.dart';
import '../events/event_model.dart';
import '../events/providers.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

enum _MapRange { upcoming, today, tomorrow, thisWeek, thisMonth }

const _mapRangeLabels = {
  _MapRange.upcoming: 'Upcoming',
  _MapRange.today: 'Today',
  _MapRange.tomorrow: 'Tomorrow',
  _MapRange.thisWeek: 'This Week',
  _MapRange.thisMonth: 'This Month',
};

class _MapScreenState extends ConsumerState<MapScreen> {
  final _mapController = MapController();
  _MapRange _range = _MapRange.upcoming;

  bool _inRange(Event e) {
    final t = e.startAt;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return switch (_range) {
      // End-aware, matching Discover: in-progress events keep their pin.
      _MapRange.upcoming => (e.endAt ?? t).isAfter(now) &&
          t.isBefore(today.add(const Duration(days: 60))),
      _MapRange.today =>
        !t.isBefore(today) && t.isBefore(today.add(const Duration(days: 1))),
      _MapRange.tomorrow => !t.isBefore(today.add(const Duration(days: 1))) &&
          t.isBefore(today.add(const Duration(days: 2))),
      _MapRange.thisWeek => t.isAfter(now) &&
          t.isBefore(today.add(Duration(days: 8 - now.weekday))),
      _MapRange.thisMonth =>
        t.isAfter(now) && t.month == now.month && t.year == now.year,
    };
  }

  @override
  void initState() {
    super.initState();
    // Focus may be set before this screen first mounts (venue tap while the
    // Map tab was never opened) — the change-listener below would miss it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnFocus());
  }

  void _centerOnFocus() {
    if (!mounted) return;
    final id = ref.read(mapFocusProvider);
    if (id == null) return;
    final all = ref.read(eventsProvider).value ?? const <Event>[];
    final e = all.where((ev) => ev.id == id).firstOrNull;
    final pos = e == null ? null : _position(e);
    if (pos != null) _mapController.move(pos.$1, 14);
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  /// City-center fallback with golden-angle jitter so same-city pins
  /// don't stack (carried over from the pre-rewrite web app).
  (LatLng, bool)? _position(Event e) {
    if (e.hasCoords) return (LatLng(e.latitude!, e.longitude!), false);
    final center = cityCoordinates[e.city];
    if (center == null) return null;
    final idHash = e.id.hashCode.abs();
    final angle = (idHash * 137.508) % 360 * math.pi / 180;
    final radius = 0.006 + (idHash % 5) * 0.003;
    return (
      LatLng(center.$1 + radius * math.sin(angle),
          center.$2 + radius * math.cos(angle)),
      true,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Recenter when the city filter changes (initialCenter only applies once).
    ref.listen(cityFilterProvider, (previous, next) {
      final c = cityCoordinates[next] ?? cityCoordinates['Tokyo']!;
      _mapController.move(LatLng(c.$1, c.$2), 10);
    });

    // Focus mode: venue tap on event detail shows just that event, centered.
    final focusId = ref.watch(mapFocusProvider);
    final focused = focusId == null
        ? null
        : (ref.watch(eventsProvider).value ?? const <Event>[])
            .where((e) => e.id == focusId)
            .firstOrNull;
    ref.listen(mapFocusProvider, (previous, next) {
      if (next == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnFocus());
    });

    final events = focused != null
        ? [focused]
        : ref.watch(filteredEventsProvider).where(_inRange).toList();

    final markers = <Marker>[];
    var approxCount = 0;
    for (final e in events) {
      final pos = _position(e);
      if (pos == null) continue;
      if (pos.$2) approxCount++;
      markers.add(
        Marker(
          point: pos.$1,
          width: 20,
          height: 20,
          child: GestureDetector(
            onTap: () => context.push('/event/${e.id}'),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: danceStyleColor(e.danceStyle)
                    .withValues(alpha: pos.$2 ? 0.45 : 0.9),
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ),
      );
    }

    final cities = events.map((e) => e.city).whereType<String>().toSet();

    return Scaffold(
      appBar: AppBar(title: const Text('Map')),
      body: Column(
        children: [
          if (focused != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: InputChip(
                  avatar: const Icon(Icons.place, size: 18),
                  label: Text('Showing: ${focused.title}',
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  onDeleted: () =>
                      ref.read(mapFocusProvider.notifier).set(null),
                ),
              ),
            )
          else ...[
            const FilterChipsRow(),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (final r in _MapRange.values)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(_mapRangeLabels[r]!),
                        selected: _range == r,
                        onSelected: (_) => setState(() => _range = r),
                      ),
                    ),
                ],
              ),
            ),
            // Count line above the map — separates the chip carousel from the
            // content, same as the Discover screen.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Text(
                '${events.length} events across ${cities.length} cities'
                '${approxCount > 0 ? ' · $approxCount pins approximate' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
          Expanded(
            flex: 3,
            child: FlutterMap(
              mapController: _mapController,
              options: const MapOptions(
                initialCenter: LatLng(35.6762, 139.6503), // Tokyo
                initialZoom: 10,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.calcaliente.calCaliente',
                ),
                MarkerLayer(markers: markers),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            flex: 2,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: events.length,
              itemBuilder: (context, i) => EventCard(event: events[i]),
            ),
          ),
        ],
      ),
    );
  }
}
