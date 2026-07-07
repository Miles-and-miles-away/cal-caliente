import 'package:flutter/material.dart';

/// Ported verbatim from cal-caliente shared/constants.ts.

const danceStyles = [
  'salsa', 'bachata', 'zouk', 'kizomba', 'merengue', 'cha-cha-cha', 'cumbia',
  'reggaeton', 'samba', 'tango', 'rumba', 'mambo', 'afro-latin', 'mixed', 'other',
];

const danceStyleLabels = {
  'salsa': 'Salsa', 'bachata': 'Bachata', 'zouk': 'Zouk', 'kizomba': 'Kizomba',
  'merengue': 'Merengue', 'cha-cha-cha': 'Cha-Cha-Cha', 'cumbia': 'Cumbia',
  'reggaeton': 'Reggaeton', 'samba': 'Samba', 'tango': 'Tango', 'rumba': 'Rumba',
  'mambo': 'Mambo', 'afro-latin': 'Afro-Latin', 'mixed': 'Mixed', 'other': 'Other',
};

const danceStyleColors = {
  'salsa': Color(0xFFE53E3E),
  'bachata': Color(0xFF805AD5),
  'zouk': Color(0xFF3182CE),
  'kizomba': Color(0xFFD69E2E),
  'merengue': Color(0xFF38A169),
  'cha-cha-cha': Color(0xFFDD6B20),
  'cumbia': Color(0xFFE53E8E),
  'reggaeton': Color(0xFF2B6CB0),
  'samba': Color(0xFFF6AD55),
  'tango': Color(0xFFC53030),
  'rumba': Color(0xFF9F7AEA),
  'mambo': Color(0xFFED64A6),
  'afro-latin': Color(0xFF2C7A7B),
  'mixed': Color(0xFF718096),
  'other': Color(0xFFA0AEC0),
};

Color danceStyleColor(String? style) =>
    danceStyleColors[style] ?? danceStyleColors['other']!;

const eventTypes = [
  'social', 'workshop', 'performance', 'festival', 'class', 'congress',
  'bootcamp', 'other',
];

const eventTypeLabels = {
  'social': 'Social Dance', 'workshop': 'Workshop', 'performance': 'Performance',
  'festival': 'Festival', 'class': 'Class', 'congress': 'Congress',
  'bootcamp': 'Bootcamp', 'other': 'Other',
};

const japanCities = [
  'Tokyo', 'Osaka', 'Nagoya', 'Fukuoka', 'Yokohama', 'Kobe', 'Sapporo',
  'Kyoto', 'Sendai', 'Hiroshima', 'Okinawa',
];

/// City-center fallback coordinates for events with a city but no GPS.
const cityCoordinates = <String, (double, double)>{
  'Tokyo': (35.6762, 139.6503),
  'Osaka': (34.6937, 135.5023),
  'Nagoya': (35.1815, 136.9066),
  'Fukuoka': (33.5904, 130.4017),
  'Yokohama': (35.4437, 139.638),
  'Kobe': (34.6901, 135.1956),
  'Sapporo': (43.0618, 141.3545),
  'Kyoto': (35.0116, 135.7681),
  'Sendai': (38.2682, 140.8694),
  'Hiroshima': (34.3853, 132.4553),
  'Okinawa': (26.2124, 127.6809),
};

const sourceTypes = ['facebook', 'instagram', 'rss', 'html', 'custom'];

const sourceTypeLabels = {
  'facebook': 'Facebook', 'instagram': 'Instagram', 'rss': 'RSS / iCal',
  'html': 'Website', 'custom': 'Custom',
};

const sourceTypeIcons = {
  'facebook': '📘', 'instagram': '📸', 'rss': '📡', 'html': '🌐', 'custom': '🔧',
};
