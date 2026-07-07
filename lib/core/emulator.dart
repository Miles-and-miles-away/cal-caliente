import 'package:flutter/foundation.dart';

/// Loopback host the Firebase Emulator Suite is reachable at, per platform.
///
/// Android emulators reach the host machine via 10.0.2.2. Everything else uses
/// the IPv4 loopback — NOT 'localhost': Firestore's gRPC resolves 'localhost'
/// to IPv6 ::1 on the iOS simulator and fails, because the emulator binds
/// 127.0.0.1 only, surfacing as a cloud_firestore/unavailable error.
String emulatorHost({
  required bool isWeb,
  required TargetPlatform platform,
}) =>
    !isWeb && platform == TargetPlatform.android ? '10.0.2.2' : '127.0.0.1';
