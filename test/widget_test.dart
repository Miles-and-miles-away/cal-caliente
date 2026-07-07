import 'package:cal_caliente/core/constants.dart';
import 'package:cal_caliente/core/emulator.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Firebase-backed widgets need the emulator; app smoke lives in
  // integration_test/. Here: pure logic only.
  test('constants stay consistent', () {
    expect(danceStyles.length, 15);
    expect(danceStyles.toSet().length, danceStyles.length);
    for (final s in danceStyles) {
      expect(danceStyleLabels.containsKey(s), isTrue, reason: s);
      expect(danceStyleColors.containsKey(s), isTrue, reason: s);
    }
    for (final t in eventTypes) {
      expect(eventTypeLabels.containsKey(t), isTrue, reason: t);
    }
    for (final c in japanCities) {
      expect(cityCoordinates.containsKey(c), isTrue, reason: c);
    }
  });

  test('emulator host is IPv4 loopback everywhere except Android', () {
    // Android emulator reaches the host machine via 10.0.2.2.
    expect(emulatorHost(isWeb: false, platform: TargetPlatform.android),
        '10.0.2.2');
    // iOS sim / desktop use IPv4 loopback (never 'localhost' → IPv6 gRPC fail).
    expect(
        emulatorHost(isWeb: false, platform: TargetPlatform.iOS), '127.0.0.1');
    expect(emulatorHost(isWeb: false, platform: TargetPlatform.macOS),
        '127.0.0.1');
    // Web talks over HTTP even on an Android browser — not the 10.0.2.2 path.
    expect(emulatorHost(isWeb: true, platform: TargetPlatform.android),
        '127.0.0.1');
    // The bug guard: 'localhost' must never be returned for any platform.
    for (final p in TargetPlatform.values) {
      expect(emulatorHost(isWeb: false, platform: p), isNot('localhost'));
      expect(emulatorHost(isWeb: true, platform: p), isNot('localhost'));
    }
  });
}
