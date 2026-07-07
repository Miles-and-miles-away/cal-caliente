import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Demo-project options — EMULATOR ONLY (emulator data is namespaced by
/// project id, so emulator runs must stay on demo-cal-caliente).
/// Real options live in firebase_options.dart (flutterfire configure).
class DemoFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Unsupported platform');
    }
  }

  // Values are fake but format-valid — the native SDKs validate shape
  // (apiKey 'AIza…' 39 chars, appId '1:<num>:<platform>:<hex>') even though
  // the emulators never check them.
  static const web = FirebaseOptions(
    apiKey: 'AIzaSyDemoEmulatorKey000000000000000000',
    appId: '1:123456789012:web:0123456789abcdef',
    messagingSenderId: '123456789012',
    projectId: 'demo-cal-caliente',
    authDomain: 'demo-cal-caliente.firebaseapp.com',
  );

  static const android = FirebaseOptions(
    apiKey: 'AIzaSyDemoEmulatorKey000000000000000000',
    appId: '1:123456789012:android:0123456789abcdef',
    messagingSenderId: '123456789012',
    projectId: 'demo-cal-caliente',
  );

  static const ios = FirebaseOptions(
    apiKey: 'AIzaSyDemoEmulatorKey000000000000000000',
    appId: '1:123456789012:ios:0123456789abcdef',
    messagingSenderId: '123456789012',
    projectId: 'demo-cal-caliente',
    iosBundleId: 'com.calcaliente.calCaliente',
  );
}
