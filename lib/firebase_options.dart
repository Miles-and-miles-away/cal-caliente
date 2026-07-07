import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Real project (cal-caliente) options. Values assembled from the app configs
/// registered by `flutterfire configure --project=cal-caliente` — regenerate
/// with flutterfire if apps change. Emulator runs use DemoFirebaseOptions
/// (firebase_options_demo.dart) instead.
class DefaultFirebaseOptions {
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

  static const web = FirebaseOptions(
    apiKey: 'AIzaSyDZ-hoSFIl_LtoNKvleFgaPKo5ITOb2dZE',
    appId: '1:249946896369:web:4c06a87c42d81f6161b650',
    messagingSenderId: '249946896369',
    projectId: 'cal-caliente',
    authDomain: 'cal-caliente.firebaseapp.com',
    storageBucket: 'cal-caliente.firebasestorage.app',
  );

  static const android = FirebaseOptions(
    apiKey: 'AIzaSyDipXhcwZ5gSWwveYglqpAuKdJGJtI-pv0',
    appId: '1:249946896369:android:02ba028d279c28c461b650',
    messagingSenderId: '249946896369',
    projectId: 'cal-caliente',
    storageBucket: 'cal-caliente.firebasestorage.app',
  );

  static const ios = FirebaseOptions(
    apiKey: 'AIzaSyCqdBGkgj4ZO9yVCZguxoQGLRQJ1l1lMoM',
    appId: '1:249946896369:ios:b34a30d913a4242b61b650',
    messagingSenderId: '249946896369',
    projectId: 'cal-caliente',
    storageBucket: 'cal-caliente.firebasestorage.app',
    iosBundleId: 'com.calcaliente.calCaliente',
  );
}
