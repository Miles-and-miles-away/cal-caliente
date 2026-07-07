import 'package:cloud_firestore/cloud_firestore.dart';

/// Plain model over the events/{canonicalKey} doc (see SCHEMA.md).
/// ponytail: manual fromDoc instead of freezed/json_serializable — Firestore
/// Timestamps need hand conversion anyway; upgrade to freezed if models multiply.
class Event {
  const Event({
    required this.id,
    required this.title,
    required this.startAt,
    required this.danceStyle,
    required this.eventType,
    required this.isAllDay,
    required this.isVerified,
    required this.isCancelled,
    this.description,
    this.endAt,
    this.venueName,
    this.venueAddress,
    this.city,
    this.prefecture,
    this.latitude,
    this.longitude,
    this.nearestStation,
    this.imageUrl,
    this.sourceUrl,
    this.price,
    this.organizer,
    this.sourceId,
    this.submittedByUid,
  });

  final String id;
  final String title;
  final DateTime startAt;
  final String danceStyle;
  final String eventType;
  final bool isAllDay;
  final bool isVerified;
  final bool isCancelled;
  final String? description;
  final DateTime? endAt;
  final String? venueName;
  final String? venueAddress;
  final String? city;
  final String? prefecture;
  final double? latitude;
  final double? longitude;
  final String? nearestStation;
  final String? imageUrl;
  final String? sourceUrl;
  final String? price;
  final String? organizer;
  final String? sourceId;
  final String? submittedByUid;

  bool get hasCoords => latitude != null && longitude != null;

  factory Event.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data()!;
    return Event(
      id: doc.id,
      title: (d['title'] as String?) ?? '(untitled)',
      startAt: (d['startAt'] as Timestamp).toDate(),
      endAt: (d['endAt'] as Timestamp?)?.toDate(),
      danceStyle: (d['danceStyle'] as String?) ?? 'other',
      eventType: (d['eventType'] as String?) ?? 'other',
      isAllDay: (d['isAllDay'] as bool?) ?? false,
      isVerified: (d['isVerified'] as bool?) ?? false,
      isCancelled: (d['isCancelled'] as bool?) ?? false,
      description: d['description'] as String?,
      venueName: d['venueName'] as String?,
      venueAddress: d['venueAddress'] as String?,
      city: d['city'] as String?,
      prefecture: d['prefecture'] as String?,
      latitude: (d['latitude'] as num?)?.toDouble(),
      longitude: (d['longitude'] as num?)?.toDouble(),
      nearestStation: d['nearestStation'] as String?,
      imageUrl: d['imageUrl'] as String?,
      sourceUrl: d['sourceUrl'] as String?,
      price: d['price'] as String?,
      organizer: d['organizer'] as String?,
      sourceId: d['sourceId'] as String?,
      submittedByUid: d['submittedByUid'] as String?,
    );
  }
}

/// sources/{id} doc.
class EventSource {
  const EventSource({
    required this.id,
    required this.name,
    required this.url,
    required this.sourceType,
    required this.isActive,
    required this.isUserAdded,
    this.addedByUid,
    this.lastScrapedAt,
  });

  final String id;
  final String name;
  final String url;
  final String sourceType;
  final bool isActive;
  final bool isUserAdded;
  final String? addedByUid;
  final DateTime? lastScrapedAt;

  factory EventSource.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data()!;
    return EventSource(
      id: doc.id,
      name: (d['name'] as String?) ?? '',
      url: (d['url'] as String?) ?? '',
      sourceType: (d['sourceType'] as String?) ?? 'html',
      isActive: (d['isActive'] as bool?) ?? true,
      isUserAdded: (d['isUserAdded'] as bool?) ?? false,
      addedByUid: d['addedByUid'] as String?,
      lastScrapedAt: (d['lastScrapedAt'] as Timestamp?)?.toDate(),
    );
  }
}
