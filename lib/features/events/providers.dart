import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'event_model.dart';

part 'providers.g.dart';

@riverpod
FirebaseFirestore firestore(Ref ref) => FirebaseFirestore.instance;

@riverpod
FirebaseFunctions functions(Ref ref) => FirebaseFunctions.instance;

/// Anonymous sign-in completes before runApp, so currentUser is always set.
@riverpod
String uid(Ref ref) => FirebaseAuth.instance.currentUser!.uid;

/// One shared window query: 30 days back (past-month view), everything forward.
/// All tabs filter this client-side — dataset is small (PRD), one listener,
/// offline cache for free.
@Riverpod(keepAlive: true)
Stream<List<Event>> events(Ref ref) {
  final since = DateTime.now().subtract(const Duration(days: 30));
  return ref
      .watch(firestoreProvider)
      .collection('events')
      .where('isCancelled', isEqualTo: false)
      .where('startAt', isGreaterThanOrEqualTo: Timestamp.fromDate(since))
      .orderBy('startAt')
      .limit(500)
      .snapshots()
      .map((snap) => snap.docs.map(Event.fromDoc).toList());
}

@riverpod
Stream<Event?> eventById(Ref ref, String id) {
  return ref
      .watch(firestoreProvider)
      .collection('events')
      .doc(id)
      .snapshots()
      .map((doc) => doc.exists ? Event.fromDoc(doc) : null);
}

@riverpod
Stream<List<EventSource>> sources(Ref ref) {
  return ref
      .watch(firestoreProvider)
      .collection('sources')
      .orderBy('createdAt')
      .snapshots()
      .map((snap) => snap.docs.map(EventSource.fromDoc).toList());
}

// ─── Filters (shared by Calendar / Discover / Map) ──────────────────────────

// These three seed from prefs, but the seeding lives in _MainShell (a
// widget-level ref.listen, router.dart) — NOT here. A Notifier.build() that
// watches the Firestore-backed userPrefsProvider self-invalidates when the
// stream emits mid-frame, crashing with "setState() called during build".
@riverpod
class DanceFilter extends _$DanceFilter {
  @override
  Set<String> build() => {}; // empty = all styles

  void toggle(String v) =>
      state = state.contains(v) ? ({...state}..remove(v)) : {...state, v};
  void setAll(Set<String> v) => state = v;
  void clear() => state = {};
}

@riverpod
class EventTypeFilter extends _$EventTypeFilter {
  @override
  Set<String> build() => {}; // empty = all types

  void toggle(String v) =>
      state = state.contains(v) ? ({...state}..remove(v)) : {...state, v};
  void setAll(Set<String> v) => state = v;
  void clear() => state = {};
}

@riverpod
class CityFilter extends _$CityFilter {
  @override
  String build() => 'all';

  void set(String v) => state = v;
}

/// When set, the Map tab shows only this event (venue tap on event detail).
/// keepAlive: set before navigating, must survive the screen switch.
@Riverpod(keepAlive: true)
class MapFocus extends _$MapFocus {
  @override
  String? build() => null;
  void set(String? id) => state = id;
}

/// Events passing the two global chip filters.
@riverpod
List<Event> filteredEvents(Ref ref) {
  final events = ref.watch(eventsProvider).value ?? const <Event>[];
  final dance = ref.watch(danceFilterProvider);
  final types = ref.watch(eventTypeFilterProvider);
  final city = ref.watch(cityFilterProvider);
  return events
      .where((e) => dance.isEmpty || dance.contains(e.danceStyle))
      .where((e) => types.isEmpty || types.contains(e.eventType))
      .where((e) => city == 'all' || e.city == city)
      .toList();
}

// ─── User doc: prefs + favorites (users/{uid}, SCHEMA.md) ───────────────────

@Riverpod(keepAlive: true)
Stream<Map<String, dynamic>> userDoc(Ref ref) {
  final uid = ref.watch(uidProvider);
  return ref
      .watch(firestoreProvider)
      .collection('users')
      .doc(uid)
      .snapshots()
      .map((doc) => doc.data() ?? const <String, dynamic>{});
}

@riverpod
List<String> favoriteEventIds(Ref ref) {
  final doc = ref.watch(userDocProvider).value ?? const {};
  return List<String>.from((doc['favoriteEventIds'] as List?) ?? const []);
}

@riverpod
Map<String, dynamic> userPrefs(Ref ref) {
  final doc = ref.watch(userDocProvider).value ?? const {};
  return Map<String, dynamic>.from((doc['prefs'] as Map?) ?? const {});
}

/// Write actions, exposed via provider so widgets can `ref.read(actionsProvider)`.
/// keepAlive: read-only usage would otherwise auto-dispose the Ref between taps.
@Riverpod(keepAlive: true)
Actions actions(Ref ref) => Actions(ref);

class Actions {
  Actions(this._ref);
  final Ref _ref;

  DocumentReference<Map<String, dynamic>> get _userDoc => _ref
      .read(firestoreProvider)
      .collection('users')
      .doc(_ref.read(uidProvider));

  Map<String, dynamic> _userBase() => {
        'prefs': _ref.read(userPrefsProvider),
        'updatedAt': FieldValue.serverTimestamp(),
        'createdAt': _ref.read(userDocProvider).value?['createdAt'] ??
            FieldValue.serverTimestamp(),
      };

  Future<void> toggleFavorite(String eventId, bool save) async {
    try {
      await _userDoc.set({
        ..._userBase(),
        'favoriteEventIds': save
            ? FieldValue.arrayUnion([eventId])
            : FieldValue.arrayRemove([eventId]),
      }, SetOptions(merge: true));
    } on FirebaseException catch (e) {
      debugPrint('toggleFavorite failed: ${e.code} ${e.message}');
    }
  }

  Future<void> updatePrefs(Map<String, dynamic> patch) async {
    try {
      await _userDoc.set({
        ..._userBase(),
        'prefs': {..._ref.read(userPrefsProvider), ...patch},
      }, SetOptions(merge: true));
    } on FirebaseException catch (e) {
      debugPrint('updatePrefs failed: ${e.code} ${e.message}');
    }
  }

  Future<void> setAttendance(String eventId, String? status) async {
    final doc = _ref
        .read(firestoreProvider)
        .collection('events')
        .doc(eventId)
        .collection('attendance')
        .doc(_ref.read(uidProvider));
    try {
      if (status == null) {
        await doc.delete();
      } else {
        await doc.set(
            {'status': status, 'updatedAt': FieldValue.serverTimestamp()});
      }
    } on FirebaseException catch (e) {
      debugPrint('setAttendance failed: ${e.code} ${e.message}');
      rethrow;
    }
    // set()/delete() resolve on server ack, so the aggregate count() sees the
    // write now — refetch. (The stream emit alone races the commit.)
    _ref.invalidate(attendanceCountsProvider(eventId));
  }
}

// ─── Attendance (RSVP) ──────────────────────────────────────────────────────

@riverpod
Stream<String?> myAttendance(Ref ref, String eventId) {
  final uid = ref.watch(uidProvider);
  return ref
      .watch(firestoreProvider)
      .collection('events')
      .doc(eventId)
      .collection('attendance')
      .doc(uid)
      .snapshots()
      .map((doc) => doc.data()?['status'] as String?);
}

@riverpod
Future<({int interested, int going})> attendanceCounts(
    Ref ref, String eventId) async {
  // Re-computes whenever my own RSVP changes.
  ref.watch(myAttendanceProvider(eventId));
  final col = ref
      .watch(firestoreProvider)
      .collection('events')
      .doc(eventId)
      .collection('attendance');
  final results = await Future.wait([
    col.where('status', isEqualTo: 'interested').count().get(),
    col.where('status', isEqualTo: 'going').count().get(),
  ]);
  return (interested: results[0].count ?? 0, going: results[1].count ?? 0);
}

