// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(firestore)
final firestoreProvider = FirestoreProvider._();

final class FirestoreProvider extends $FunctionalProvider<FirebaseFirestore,
    FirebaseFirestore, FirebaseFirestore> with $Provider<FirebaseFirestore> {
  FirestoreProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'firestoreProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$firestoreHash();

  @$internal
  @override
  $ProviderElement<FirebaseFirestore> $createElement(
          $ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  FirebaseFirestore create(Ref ref) {
    return firestore(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FirebaseFirestore value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FirebaseFirestore>(value),
    );
  }
}

String _$firestoreHash() => r'597b1a9eb96f2fae51f5b578f4b5debe4f6d30c6';

@ProviderFor(functions)
final functionsProvider = FunctionsProvider._();

final class FunctionsProvider extends $FunctionalProvider<FirebaseFunctions,
    FirebaseFunctions, FirebaseFunctions> with $Provider<FirebaseFunctions> {
  FunctionsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'functionsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$functionsHash();

  @$internal
  @override
  $ProviderElement<FirebaseFunctions> $createElement(
          $ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  FirebaseFunctions create(Ref ref) {
    return functions(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FirebaseFunctions value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FirebaseFunctions>(value),
    );
  }
}

String _$functionsHash() => r'7b34c0406d9143c003b9f1f4f748715f456331a1';

/// Anonymous sign-in completes before runApp, so currentUser is always set.

@ProviderFor(uid)
final uidProvider = UidProvider._();

/// Anonymous sign-in completes before runApp, so currentUser is always set.

final class UidProvider extends $FunctionalProvider<String, String, String>
    with $Provider<String> {
  /// Anonymous sign-in completes before runApp, so currentUser is always set.
  UidProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'uidProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$uidHash();

  @$internal
  @override
  $ProviderElement<String> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  String create(Ref ref) {
    return uid(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(String value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<String>(value),
    );
  }
}

String _$uidHash() => r'40d906f35b90a1790d3334299276b08fed2ebb0c';

/// One shared window query: 30 days back (past-month view), everything forward.
/// All tabs filter this client-side — dataset is small (PRD), one listener,
/// offline cache for free.

@ProviderFor(events)
final eventsProvider = EventsProvider._();

/// One shared window query: 30 days back (past-month view), everything forward.
/// All tabs filter this client-side — dataset is small (PRD), one listener,
/// offline cache for free.

final class EventsProvider extends $FunctionalProvider<AsyncValue<List<Event>>,
        List<Event>, Stream<List<Event>>>
    with $FutureModifier<List<Event>>, $StreamProvider<List<Event>> {
  /// One shared window query: 30 days back (past-month view), everything forward.
  /// All tabs filter this client-side — dataset is small (PRD), one listener,
  /// offline cache for free.
  EventsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'eventsProvider',
          isAutoDispose: false,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$eventsHash();

  @$internal
  @override
  $StreamProviderElement<List<Event>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<Event>> create(Ref ref) {
    return events(ref);
  }
}

String _$eventsHash() => r'042057f497e325b211a5995964a66d5fd22faa94';

@ProviderFor(eventById)
final eventByIdProvider = EventByIdFamily._();

final class EventByIdProvider
    extends $FunctionalProvider<AsyncValue<Event?>, Event?, Stream<Event?>>
    with $FutureModifier<Event?>, $StreamProvider<Event?> {
  EventByIdProvider._(
      {required EventByIdFamily super.from, required String super.argument})
      : super(
          retry: null,
          name: r'eventByIdProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$eventByIdHash();

  @override
  String toString() {
    return r'eventByIdProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<Event?> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Event?> create(Ref ref) {
    final argument = this.argument as String;
    return eventById(
      ref,
      argument,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is EventByIdProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$eventByIdHash() => r'a68520b8011cbc4ecca58a83c7972474141ecbfc';

final class EventByIdFamily extends $Family
    with $FunctionalFamilyOverride<Stream<Event?>, String> {
  EventByIdFamily._()
      : super(
          retry: null,
          name: r'eventByIdProvider',
          dependencies: null,
          $allTransitiveDependencies: null,
          isAutoDispose: true,
        );

  EventByIdProvider call(
    String id,
  ) =>
      EventByIdProvider._(argument: id, from: this);

  @override
  String toString() => r'eventByIdProvider';
}

@ProviderFor(sources)
final sourcesProvider = SourcesProvider._();

final class SourcesProvider extends $FunctionalProvider<
        AsyncValue<List<EventSource>>,
        List<EventSource>,
        Stream<List<EventSource>>>
    with
        $FutureModifier<List<EventSource>>,
        $StreamProvider<List<EventSource>> {
  SourcesProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'sourcesProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$sourcesHash();

  @$internal
  @override
  $StreamProviderElement<List<EventSource>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<EventSource>> create(Ref ref) {
    return sources(ref);
  }
}

String _$sourcesHash() => r'162941deb57def9bcd1e6f7c54d5b1e71e79d092';

@ProviderFor(DanceFilter)
final danceFilterProvider = DanceFilterProvider._();

final class DanceFilterProvider
    extends $NotifierProvider<DanceFilter, Set<String>> {
  DanceFilterProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'danceFilterProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$danceFilterHash();

  @$internal
  @override
  DanceFilter create() => DanceFilter();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Set<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Set<String>>(value),
    );
  }
}

String _$danceFilterHash() => r'7c30e159ee9bbae38b0aafa53279e861ea63ae0d';

abstract class _$DanceFilter extends $Notifier<Set<String>> {
  Set<String> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<Set<String>, Set<String>>;
    final element = ref.element as $ClassProviderElement<
        AnyNotifier<Set<String>, Set<String>>, Set<String>, Object?, Object?>;
    return element.handleCreate(ref, build);
  }
}

@ProviderFor(EventTypeFilter)
final eventTypeFilterProvider = EventTypeFilterProvider._();

final class EventTypeFilterProvider
    extends $NotifierProvider<EventTypeFilter, Set<String>> {
  EventTypeFilterProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'eventTypeFilterProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$eventTypeFilterHash();

  @$internal
  @override
  EventTypeFilter create() => EventTypeFilter();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Set<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Set<String>>(value),
    );
  }
}

String _$eventTypeFilterHash() => r'2f1165b6d55666dbc06b5011673908d5d26f4303';

abstract class _$EventTypeFilter extends $Notifier<Set<String>> {
  Set<String> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<Set<String>, Set<String>>;
    final element = ref.element as $ClassProviderElement<
        AnyNotifier<Set<String>, Set<String>>, Set<String>, Object?, Object?>;
    return element.handleCreate(ref, build);
  }
}

@ProviderFor(CityFilter)
final cityFilterProvider = CityFilterProvider._();

final class CityFilterProvider extends $NotifierProvider<CityFilter, String> {
  CityFilterProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'cityFilterProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$cityFilterHash();

  @$internal
  @override
  CityFilter create() => CityFilter();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(String value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<String>(value),
    );
  }
}

String _$cityFilterHash() => r'471b133913c0acca92da9f5ab0eee9432ca53873';

abstract class _$CityFilter extends $Notifier<String> {
  String build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<String, String>;
    final element = ref.element as $ClassProviderElement<
        AnyNotifier<String, String>, String, Object?, Object?>;
    return element.handleCreate(ref, build);
  }
}

/// When set, the Map tab shows only this event (venue tap on event detail).
/// keepAlive: set before navigating, must survive the screen switch.

@ProviderFor(MapFocus)
final mapFocusProvider = MapFocusProvider._();

/// When set, the Map tab shows only this event (venue tap on event detail).
/// keepAlive: set before navigating, must survive the screen switch.
final class MapFocusProvider extends $NotifierProvider<MapFocus, String?> {
  /// When set, the Map tab shows only this event (venue tap on event detail).
  /// keepAlive: set before navigating, must survive the screen switch.
  MapFocusProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'mapFocusProvider',
          isAutoDispose: false,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$mapFocusHash();

  @$internal
  @override
  MapFocus create() => MapFocus();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(String? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<String?>(value),
    );
  }
}

String _$mapFocusHash() => r'f1b7ab64f3fdb07039a88a80ee7b9f1d437422cf';

/// When set, the Map tab shows only this event (venue tap on event detail).
/// keepAlive: set before navigating, must survive the screen switch.

abstract class _$MapFocus extends $Notifier<String?> {
  String? build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<String?, String?>;
    final element = ref.element as $ClassProviderElement<
        AnyNotifier<String?, String?>, String?, Object?, Object?>;
    return element.handleCreate(ref, build);
  }
}

/// Events passing the two global chip filters.

@ProviderFor(filteredEvents)
final filteredEventsProvider = FilteredEventsProvider._();

/// Events passing the two global chip filters.

final class FilteredEventsProvider
    extends $FunctionalProvider<List<Event>, List<Event>, List<Event>>
    with $Provider<List<Event>> {
  /// Events passing the two global chip filters.
  FilteredEventsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'filteredEventsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$filteredEventsHash();

  @$internal
  @override
  $ProviderElement<List<Event>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  List<Event> create(Ref ref) {
    return filteredEvents(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<Event> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<Event>>(value),
    );
  }
}

String _$filteredEventsHash() => r'54340d99217249b84aadaf04046b6c3eb6208c52';

@ProviderFor(userDoc)
final userDocProvider = UserDocProvider._();

final class UserDocProvider extends $FunctionalProvider<
        AsyncValue<Map<String, dynamic>>,
        Map<String, dynamic>,
        Stream<Map<String, dynamic>>>
    with
        $FutureModifier<Map<String, dynamic>>,
        $StreamProvider<Map<String, dynamic>> {
  UserDocProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'userDocProvider',
          isAutoDispose: false,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$userDocHash();

  @$internal
  @override
  $StreamProviderElement<Map<String, dynamic>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Map<String, dynamic>> create(Ref ref) {
    return userDoc(ref);
  }
}

String _$userDocHash() => r'4fcb529f1ffd42489bc9b3f59a8fa4c7a24d244d';

@ProviderFor(favoriteEventIds)
final favoriteEventIdsProvider = FavoriteEventIdsProvider._();

final class FavoriteEventIdsProvider
    extends $FunctionalProvider<List<String>, List<String>, List<String>>
    with $Provider<List<String>> {
  FavoriteEventIdsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'favoriteEventIdsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$favoriteEventIdsHash();

  @$internal
  @override
  $ProviderElement<List<String>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  List<String> create(Ref ref) {
    return favoriteEventIds(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<String>>(value),
    );
  }
}

String _$favoriteEventIdsHash() => r'836c67e8bf06f76f823088ec715c31fe0bd12e8e';

@ProviderFor(userPrefs)
final userPrefsProvider = UserPrefsProvider._();

final class UserPrefsProvider extends $FunctionalProvider<
    Map<String, dynamic>,
    Map<String, dynamic>,
    Map<String, dynamic>> with $Provider<Map<String, dynamic>> {
  UserPrefsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'userPrefsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$userPrefsHash();

  @$internal
  @override
  $ProviderElement<Map<String, dynamic>> $createElement(
          $ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Map<String, dynamic> create(Ref ref) {
    return userPrefs(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Map<String, dynamic> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Map<String, dynamic>>(value),
    );
  }
}

String _$userPrefsHash() => r'c5d81a072f6ba1d1521ae70f0112671935bcf8e7';

/// Write actions, exposed via provider so widgets can `ref.read(actionsProvider)`.
/// keepAlive: read-only usage would otherwise auto-dispose the Ref between taps.

@ProviderFor(actions)
final actionsProvider = ActionsProvider._();

/// Write actions, exposed via provider so widgets can `ref.read(actionsProvider)`.
/// keepAlive: read-only usage would otherwise auto-dispose the Ref between taps.

final class ActionsProvider
    extends $FunctionalProvider<Actions, Actions, Actions>
    with $Provider<Actions> {
  /// Write actions, exposed via provider so widgets can `ref.read(actionsProvider)`.
  /// keepAlive: read-only usage would otherwise auto-dispose the Ref between taps.
  ActionsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'actionsProvider',
          isAutoDispose: false,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$actionsHash();

  @$internal
  @override
  $ProviderElement<Actions> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Actions create(Ref ref) {
    return actions(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Actions value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Actions>(value),
    );
  }
}

String _$actionsHash() => r'005097b25263a8f28ea092bdccc975d421749f28';

@ProviderFor(myAttendance)
final myAttendanceProvider = MyAttendanceFamily._();

final class MyAttendanceProvider
    extends $FunctionalProvider<AsyncValue<String?>, String?, Stream<String?>>
    with $FutureModifier<String?>, $StreamProvider<String?> {
  MyAttendanceProvider._(
      {required MyAttendanceFamily super.from, required String super.argument})
      : super(
          retry: null,
          name: r'myAttendanceProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$myAttendanceHash();

  @override
  String toString() {
    return r'myAttendanceProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<String?> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<String?> create(Ref ref) {
    final argument = this.argument as String;
    return myAttendance(
      ref,
      argument,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is MyAttendanceProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$myAttendanceHash() => r'92c6d949853fb8413d669460371595a3e05939f2';

final class MyAttendanceFamily extends $Family
    with $FunctionalFamilyOverride<Stream<String?>, String> {
  MyAttendanceFamily._()
      : super(
          retry: null,
          name: r'myAttendanceProvider',
          dependencies: null,
          $allTransitiveDependencies: null,
          isAutoDispose: true,
        );

  MyAttendanceProvider call(
    String eventId,
  ) =>
      MyAttendanceProvider._(argument: eventId, from: this);

  @override
  String toString() => r'myAttendanceProvider';
}

@ProviderFor(attendanceCounts)
final attendanceCountsProvider = AttendanceCountsFamily._();

final class AttendanceCountsProvider extends $FunctionalProvider<
        AsyncValue<
            ({
              int going,
              int interested,
            })>,
        ({
          int going,
          int interested,
        }),
        FutureOr<
            ({
              int going,
              int interested,
            })>>
    with
        $FutureModifier<
            ({
              int going,
              int interested,
            })>,
        $FutureProvider<
            ({
              int going,
              int interested,
            })> {
  AttendanceCountsProvider._(
      {required AttendanceCountsFamily super.from,
      required String super.argument})
      : super(
          retry: null,
          name: r'attendanceCountsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$attendanceCountsHash();

  @override
  String toString() {
    return r'attendanceCountsProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<
      ({
        int going,
        int interested,
      })> $createElement(
          $ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<
      ({
        int going,
        int interested,
      })> create(Ref ref) {
    final argument = this.argument as String;
    return attendanceCounts(
      ref,
      argument,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AttendanceCountsProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$attendanceCountsHash() => r'e73cfdf9e7719e1062ddad7a04a678f192fab8b1';

final class AttendanceCountsFamily extends $Family
    with
        $FunctionalFamilyOverride<
            FutureOr<
                ({
                  int going,
                  int interested,
                })>,
            String> {
  AttendanceCountsFamily._()
      : super(
          retry: null,
          name: r'attendanceCountsProvider',
          dependencies: null,
          $allTransitiveDependencies: null,
          isAutoDispose: true,
        );

  AttendanceCountsProvider call(
    String eventId,
  ) =>
      AttendanceCountsProvider._(argument: eventId, from: this);

  @override
  String toString() => r'attendanceCountsProvider';
}
