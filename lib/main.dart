import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/emulator.dart';
import 'firebase_options.dart';
import 'firebase_options_demo.dart';

// Same pattern as Seed: --dart-define=USE_EMULATOR=true wires the emulator suite.
// ignore: do_not_use_environment
const _useEmulator = bool.fromEnvironment('USE_EMULATOR');

// Web App Check needs a reCAPTCHA v3 site key from the Firebase console; supply
// it at build time (--dart-define=RECAPTCHA_SITE_KEY=…). Empty = skip web App
// Check (harmless while server enforcement is off; see functions ENFORCE_APP_CHECK).
// ignore: do_not_use_environment
const _recaptchaSiteKey = String.fromEnvironment('RECAPTCHA_SITE_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Emulator data is namespaced by project id — emulator runs stay on the
  // demo project; everything else talks to the real cal-caliente project.
  await Firebase.initializeApp(
      options: _useEmulator
          ? DemoFirebaseOptions.currentPlatform
          : DefaultFirebaseOptions.currentPlatform);

  if (_useEmulator) {
    final host =
        emulatorHost(isWeb: kIsWeb, platform: defaultTargetPlatform);
    // Point Firestore at the emulator. persistenceEnabled:false keeps dev runs
    // on fresh emulator data and stops an empty offline cache from masking a
    // failed connection (fromCache=true hid a dead connection for ages).
    // NOTE: the iOS simulator DOES work against the emulator (verified iOS 26.2,
    // firebase-ios-sdk 12.15 / gRPC 1.69). If it shows no data, check the whole
    // suite is up first — a dead auth emulator stalls the sign-in await below
    // and looks exactly like a Firestore connection failure.
    FirebaseFirestore.instance.settings = Settings(
      host: '$host:8080',
      sslEnabled: false,
      persistenceEnabled: false,
    );
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFunctions.instance.useFunctionsEmulator(host, 5001);
    debugPrint('Connected to Firebase Emulator Suite at $host');
  }

  // App Check attests that callable requests come from a genuine build of the
  // app. Debug providers in the emulator; Play Integrity / App Attest in
  // release. Web is skipped unless a reCAPTCHA site key was supplied. The
  // callables enforce App Check (ENFORCE_APP_CHECK=true), so the emulator build
  // needs the debug provider too — do not skip it.
  if (!kIsWeb || _recaptchaSiteKey.isNotEmpty) {
    await FirebaseAppCheck.instance.activate(
      providerAndroid: _useEmulator
          ? const AndroidDebugProvider()
          : const AndroidPlayIntegrityProvider(),
      providerApple: _useEmulator
          ? const AppleDebugProvider()
          : const AppleAppAttestProvider(),
      providerWeb: _recaptchaSiteKey.isEmpty
          ? null
          : ReCaptchaV3Provider(_recaptchaSiteKey),
    );
  }

  // ponytail: anonymous-only auth until a real Firebase project exists;
  // add Google (and Apple, for iOS release) then.
  if (FirebaseAuth.instance.currentUser == null) {
    await FirebaseAuth.instance.signInAnonymously();
  }

  runApp(const ProviderScope(child: CalCalienteApp()));
}
