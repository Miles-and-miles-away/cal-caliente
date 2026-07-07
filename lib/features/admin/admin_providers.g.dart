// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// True when the signed-in user carries the `admin: true` custom claim
/// (granted once via the Admin SDK, or the Auth emulator UI locally).

@ProviderFor(isAdmin)
final isAdminProvider = IsAdminProvider._();

/// True when the signed-in user carries the `admin: true` custom claim
/// (granted once via the Admin SDK, or the Auth emulator UI locally).

final class IsAdminProvider
    extends $FunctionalProvider<AsyncValue<bool>, bool, FutureOr<bool>>
    with $FutureModifier<bool>, $FutureProvider<bool> {
  /// True when the signed-in user carries the `admin: true` custom claim
  /// (granted once via the Admin SDK, or the Auth emulator UI locally).
  IsAdminProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'isAdminProvider',
          isAutoDispose: false,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$isAdminHash();

  @$internal
  @override
  $FutureProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<bool> create(Ref ref) {
    return isAdmin(ref);
  }
}

String _$isAdminHash() => r'9cc49177c296d657c25a534eb8dbd82b9e63bc73';

@ProviderFor(adminStats)
final adminStatsProvider = AdminStatsProvider._();

final class AdminStatsProvider extends $FunctionalProvider<
        AsyncValue<AdminStats>, AdminStats, FutureOr<AdminStats>>
    with $FutureModifier<AdminStats>, $FutureProvider<AdminStats> {
  AdminStatsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'adminStatsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$adminStatsHash();

  @$internal
  @override
  $FutureProviderElement<AdminStats> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<AdminStats> create(Ref ref) {
    return adminStats(ref);
  }
}

String _$adminStatsHash() => r'a30137ac242799b93c8550286850cddb200a6a6c';

@ProviderFor(recentScrapeLogs)
final recentScrapeLogsProvider = RecentScrapeLogsProvider._();

final class RecentScrapeLogsProvider extends $FunctionalProvider<
        AsyncValue<List<ScrapeLogEntry>>,
        List<ScrapeLogEntry>,
        Stream<List<ScrapeLogEntry>>>
    with
        $FutureModifier<List<ScrapeLogEntry>>,
        $StreamProvider<List<ScrapeLogEntry>> {
  RecentScrapeLogsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'recentScrapeLogsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$recentScrapeLogsHash();

  @$internal
  @override
  $StreamProviderElement<List<ScrapeLogEntry>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<ScrapeLogEntry>> create(Ref ref) {
    return recentScrapeLogs(ref);
  }
}

String _$recentScrapeLogsHash() => r'6bd67f9ad386217d011adddb988b7937dc54c734';

/// Community submissions, including cancelled ones (the main events stream
/// filters those out — the admin needs to see and un-cancel them).

@ProviderFor(communityEvents)
final communityEventsProvider = CommunityEventsProvider._();

/// Community submissions, including cancelled ones (the main events stream
/// filters those out — the admin needs to see and un-cancel them).

final class CommunityEventsProvider extends $FunctionalProvider<
        AsyncValue<List<Event>>, List<Event>, Stream<List<Event>>>
    with $FutureModifier<List<Event>>, $StreamProvider<List<Event>> {
  /// Community submissions, including cancelled ones (the main events stream
  /// filters those out — the admin needs to see and un-cancel them).
  CommunityEventsProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'communityEventsProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$communityEventsHash();

  @$internal
  @override
  $StreamProviderElement<List<Event>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<Event>> create(Ref ref) {
    return communityEvents(ref);
  }
}

String _$communityEventsHash() => r'f1cc2474e5230301b241f241b112069f1fa0c25e';

@ProviderFor(adminUsers)
final adminUsersProvider = AdminUsersProvider._();

final class AdminUsersProvider extends $FunctionalProvider<
        AsyncValue<List<AdminUser>>, List<AdminUser>, Stream<List<AdminUser>>>
    with $FutureModifier<List<AdminUser>>, $StreamProvider<List<AdminUser>> {
  AdminUsersProvider._()
      : super(
          from: null,
          argument: null,
          retry: null,
          name: r'adminUsersProvider',
          isAutoDispose: true,
          dependencies: null,
          $allTransitiveDependencies: null,
        );

  @override
  String debugGetCreateSourceHash() => _$adminUsersHash();

  @$internal
  @override
  $StreamProviderElement<List<AdminUser>> $createElement(
          $ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<AdminUser>> create(Ref ref) {
    return adminUsers(ref);
  }
}

String _$adminUsersHash() => r'7e3127a881f1407caedb3d3778f836b95424756c';
