import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../events/event_model.dart';
import '../events/providers.dart';

part 'admin_providers.g.dart';

/// True when the signed-in user carries the `admin: true` custom claim
/// (granted once via the Admin SDK, or the Auth emulator UI locally).
@Riverpod(keepAlive: true)
Future<bool> isAdmin(Ref ref) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return false;
  try {
    // No forceRefresh: the sign-in token already carries the claim, and the
    // extra securetoken round-trip is a needless failure point.
    final token = await user.getIdTokenResult();
    return token.claims?['admin'] == true;
  } catch (e) {
    debugPrint('isAdmin check failed: $e');
    return false;
  }
}

typedef AdminStats = ({
  int events,
  int communityEvents,
  int sources,
  int users,
  int rsvps,
});

@riverpod
Future<AdminStats> adminStats(Ref ref) async {
  final db = ref.watch(firestoreProvider);
  final r = await Future.wait([
    db.collection('events').count().get(),
    db.collection('events').where('isVerified', isEqualTo: false).count().get(),
    db.collection('sources').count().get(),
    db.collection('users').count().get(),
    db.collectionGroup('attendance').count().get(),
  ]);
  return (
    events: r[0].count ?? 0,
    communityEvents: r[1].count ?? 0,
    sources: r[2].count ?? 0,
    users: r[3].count ?? 0,
    rsvps: r[4].count ?? 0,
  );
}

typedef ScrapeLogEntry = ({
  String sourceId,
  String status,
  int eventsFound,
  int eventsAdded,
  String? errorMessage,
  DateTime? createdAt,
});

@riverpod
Stream<List<ScrapeLogEntry>> recentScrapeLogs(Ref ref) {
  return ref
      .watch(firestoreProvider)
      .collectionGroup('scrapeLogs')
      .orderBy('createdAt', descending: true)
      .limit(20)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => (
                sourceId: d.reference.parent.parent?.id ?? '?',
                status: (d.data()['status'] as String?) ?? '?',
                eventsFound: (d.data()['eventsFound'] as num?)?.toInt() ?? 0,
                eventsAdded: (d.data()['eventsAdded'] as num?)?.toInt() ?? 0,
                errorMessage: d.data()['errorMessage'] as String?,
                createdAt: (d.data()['createdAt'] as Timestamp?)?.toDate(),
              ))
          .toList());
}

/// Community submissions, including cancelled ones (the main events stream
/// filters those out — the admin needs to see and un-cancel them).
@riverpod
Stream<List<Event>> communityEvents(Ref ref) {
  return ref
      .watch(firestoreProvider)
      .collection('events')
      .where('isVerified', isEqualTo: false)
      .orderBy('startAt', descending: true)
      .limit(50)
      .snapshots()
      .map((snap) => snap.docs.map(Event.fromDoc).toList());
}

typedef AdminUser = ({String uid, int favorites, DateTime? createdAt});

@riverpod
Stream<List<AdminUser>> adminUsers(Ref ref) {
  return ref
      .watch(firestoreProvider)
      .collection('users')
      .limit(100)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => (
                uid: d.id,
                favorites: ((d.data()['favoriteEventIds'] as List?) ?? const [])
                    .length,
                createdAt: (d.data()['createdAt'] as Timestamp?)?.toDate(),
              ))
          .toList());
}
