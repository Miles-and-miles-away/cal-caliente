import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/events/providers.dart';
import 'router.dart';

class CalCalienteApp extends ConsumerWidget {
  const CalCalienteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(userPrefsProvider);
    final themePref = prefs['theme'] as String? ?? 'system';
    final language = prefs['language'] as String?;
    return MaterialApp.router(
      title: 'Cal Caliente',
      debugShowCheckedModeBanner: false,
      // Locale plumbing provisioned (EN/JA/ES, like Seed). App strings are
      // still English-only — ARB-based l10n is the follow-up; this already
      // localizes framework widgets (pickers, tooltips) and date semantics.
      locale: language == null ? null : Locale(language),
      supportedLocales: const [Locale('en'), Locale('ja'), Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE53E3E)),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE53E3E),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: switch (themePref) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
      routerConfig: ref.watch(routerProvider),
    );
  }
}
