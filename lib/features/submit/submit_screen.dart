import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants.dart';
import '../events/providers.dart';

class SubmitScreen extends ConsumerStatefulWidget {
  const SubmitScreen({super.key});

  @override
  ConsumerState<SubmitScreen> createState() => _SubmitScreenState();
}

class _SubmitScreenState extends ConsumerState<SubmitScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _venueName = TextEditingController();
  final _venueAddress = TextEditingController();
  final _station = TextEditingController();
  final _price = TextEditingController();
  final _organizer = TextEditingController();
  final _sourceUrl = TextEditingController();
  DateTime? _date;
  TimeOfDay? _time;
  TimeOfDay? _endTime;
  String _danceStyle = 'salsa';
  String _eventType = 'social';
  String _city = 'Tokyo';
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [
      _title,
      _description,
      _venueName,
      _venueAddress,
      _station,
      _price,
      _organizer,
      _sourceUrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Old app sent ISO-8601 with the JST offset (buildJstIso); same here.
  String _jstIso(DateTime date, TimeOfDay time) {
    final d = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    return '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}T'
        '${d.hour.toString().padLeft(2, '0')}:'
        '${d.minute.toString().padLeft(2, '0')}:00+09:00';
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_date == null || _time == null) {
      _snack('Pick a date and start time');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(functionsProvider).httpsCallable('submitEvent').call({
        'title': _title.text.trim(),
        'startAt': _jstIso(_date!, _time!),
        if (_endTime != null) 'endAt': _jstIso(_date!, _endTime!),
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        'danceStyle': _danceStyle,
        'eventType': _eventType,
        if (_venueName.text.trim().isNotEmpty)
          'venueName': _venueName.text.trim(),
        if (_venueAddress.text.trim().isNotEmpty)
          'venueAddress': _venueAddress.text.trim(),
        'city': _city,
        if (_station.text.trim().isNotEmpty)
          'nearestStation': _station.text.trim(),
        if (_price.text.trim().isNotEmpty) 'price': _price.text.trim(),
        if (_organizer.text.trim().isNotEmpty)
          'organizer': _organizer.text.trim(),
        if (_sourceUrl.text.trim().isNotEmpty)
          'sourceUrl': _sourceUrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Event submitted!')));
      context.pop();
    } on FirebaseFunctionsException catch (e) {
      if (e.code == 'already-exists') {
        final existingId = (e.details as Map?)?['id'] as String?;
        if (!mounted) return;
        final open = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Duplicate event'),
            content: Text(e.message ?? 'This event already exists.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('OK')),
              if (existingId != null)
                TextButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('View existing')),
            ],
          ),
        );
        if (open == true && existingId != null && mounted) {
          context.push('/event/$existingId');
        }
      } else {
        _snack('Failed: ${e.message}');
      }
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
    return Scaffold(
      appBar: AppBar(title: const Text('Submit an Event')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _title,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'Title *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text(_date == null
                      ? 'Date *'
                      : '${_date!.year}-${_date!.month.toString().padLeft(2, '0')}-${_date!.day.toString().padLeft(2, '0')}'),
                  onPressed: () async {
                    final d = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (d != null) setState(() => _date = d);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.schedule),
                  label:
                      Text(_time == null ? 'Start *' : _time!.format(context)),
                  onPressed: () async {
                    final t = await showTimePicker(
                        context: context,
                        initialTime: const TimeOfDay(hour: 19, minute: 0));
                    if (t != null) setState(() => _time = t);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.schedule_outlined),
                  label: Text(
                      _endTime == null ? 'End' : _endTime!.format(context)),
                  onPressed: () async {
                    final t = await showTimePicker(
                        context: context,
                        initialTime: const TimeOfDay(hour: 22, minute: 0));
                    if (t != null) setState(() => _endTime = t);
                  },
                ),
              ),
            ]),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _danceStyle,
              decoration: const InputDecoration(labelText: 'Dance style'),
              items: [
                for (final s in danceStyles)
                  DropdownMenuItem(value: s, child: Text(danceStyleLabels[s]!)),
              ],
              onChanged: (v) => setState(() => _danceStyle = v!),
            ),
            DropdownButtonFormField<String>(
              initialValue: _eventType,
              decoration: const InputDecoration(labelText: 'Event type'),
              items: [
                for (final t in eventTypes)
                  DropdownMenuItem(value: t, child: Text(eventTypeLabels[t]!)),
              ],
              onChanged: (v) => setState(() => _eventType = v!),
            ),
            DropdownButtonFormField<String>(
              initialValue: _city,
              decoration: const InputDecoration(labelText: 'City'),
              items: [
                for (final c in japanCities)
                  DropdownMenuItem(value: c, child: Text(c)),
              ],
              onChanged: (v) => setState(() => _city = v!),
            ),
            TextFormField(
              controller: _venueName,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'Venue name'),
            ),
            TextFormField(
              controller: _venueAddress,
              decoration: const InputDecoration(labelText: 'Venue address'),
            ),
            TextFormField(
              controller: _station,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Nearest station'),
            ),
            TextFormField(
              controller: _price,
              maxLength: 200,
              decoration: const InputDecoration(
                  labelText: 'Price (e.g. ¥1500 + drink)'),
            ),
            TextFormField(
              controller: _organizer,
              maxLength: 300,
              decoration: const InputDecoration(labelText: 'Organizer'),
            ),
            TextFormField(
              controller: _sourceUrl,
              decoration:
                  const InputDecoration(labelText: 'Source URL (https://…)'),
              keyboardType: TextInputType.url,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                final uri = Uri.tryParse(v.trim());
                return (uri != null &&
                        (uri.scheme == 'http' || uri.scheme == 'https'))
                    ? null
                    : 'Must be an http(s) URL';
              },
            ),
            TextFormField(
              controller: _description,
              maxLength: 5000,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Submitting…' : 'Submit Event'),
            ),
          ],
        ),
      ),
    );
  }
}
