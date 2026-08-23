import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../core/constants.dart';
import 'event_card.dart';
import 'event_model.dart';
import 'providers.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();
  bool _myCalendarOnly = false;

  DateTime _dayKey(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Widget build(BuildContext context) {
    final events = ref.watch(filteredEventsProvider);
    final favorites = ref.watch(favoriteEventIdsProvider);
    final visible = _myCalendarOnly
        ? events.where((e) => favorites.contains(e.id)).toList()
        : events;

    final byDay = <DateTime, List<Event>>{};
    for (final e in visible) {
      byDay.putIfAbsent(_dayKey(e.startAt), () => []).add(e);
    }
    final dayEvents = byDay[_dayKey(_selectedDay)] ?? const <Event>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('💃 Cal Caliente'),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _myCalendarOnly = !_myCalendarOnly),
            icon: Icon(_myCalendarOnly ? Icons.bookmark : Icons.public),
            label: Text(_myCalendarOnly
                ? 'My Calendar (${favorites.length})'
                : 'All Events'),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Submit an event',
            onPressed: () => context.push('/submit'),
          ),
        ],
      ),
      body: Column(
        children: [
          const FilterChipsRow(),
          TableCalendar<Event>(
            firstDay: DateTime.now().subtract(const Duration(days: 60)),
            lastDay: DateTime.now().add(const Duration(days: 365)),
            focusedDay: _focusedDay,
            selectedDayPredicate: (d) => isSameDay(d, _selectedDay),
            eventLoader: (d) => byDay[_dayKey(d)] ?? const [],
            calendarFormat: CalendarFormat.month,
            availableCalendarFormats: const {CalendarFormat.month: 'Month'},
            onDaySelected: (selected, focused) => setState(() {
              _selectedDay = selected;
              _focusedDay = focused;
            }),
            onPageChanged: (focused) => _focusedDay = focused,
            calendarBuilders: CalendarBuilders(
              markerBuilder: (context, day, dayEvents) {
                if (dayEvents.isEmpty) return null;
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final e in dayEvents.take(4))
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: danceStyleColor(e.danceStyle),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Row(
              children: [
                Text(
                  DateFormat('EEEE, d MMMM').format(_selectedDay),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const Spacer(),
                Text('${dayEvents.length} events',
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Expanded(
            child: dayEvents.isEmpty
                ? Center(
                    child: Text(
                      _myCalendarOnly
                          ? 'No saved events this day'
                          : 'No events this day',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: dayEvents.length,
                    itemBuilder: (context, i) => EventCard(event: dayEvents[i]),
                  ),
          ),
        ],
      ),
    );
  }
}
