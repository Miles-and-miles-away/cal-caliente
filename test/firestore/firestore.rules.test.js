// Security-rules tests for firestore.rules, run against the Firestore
// emulator. Launch with `npm run test:rules` from the repo root, which
// boots the emulator via `firebase emulators:exec` and then runs Jest.
//
// These cover what the Dart fakes cannot (fake_cloud_firestore ignores
// rules): the rules artifact itself. See SCHEMA.md for the contract.

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  Timestamp,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-cal-caliente';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const ALICE = 'alice';
const BOB = 'bob';

let testEnv;

function aliceDb() {
  return testEnv.authenticatedContext(ALICE).firestore();
}

function bobDb() {
  return testEnv.authenticatedContext(BOB).firestore();
}

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

// Seed data bypassing rules (admin-equivalent), matching what the seed
// script / Cloud Functions write with the Admin SDK.
async function seed(docPath, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), docPath), data);
  });
}

const EVENT_ID = 'abc123abc123abc123abc123abc123ab';

const baseEvent = {
  title: 'Roppongi Salsa Social',
  description: null,
  danceStyle: 'salsa',
  eventType: 'social',
  startAt: Timestamp.now(),
  endAt: null,
  isAllDay: false,
  venueName: 'Salsa Sudada',
  venueAddress: null,
  city: 'Tokyo',
  prefecture: 'Tokyo',
  latitude: null,
  longitude: null,
  nearestStation: null,
  imageUrl: null,
  sourceUrl: null,
  price: null,
  organizer: null,
  sourceId: null,
  submittedByUid: null,
  isVerified: true,
  isCancelled: false,
  canonicalKey: EVENT_ID,
  venueDateKey: null,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const baseSource = {
  name: 'SalsaVida Tokyo',
  url: 'https://www.salsavida.com/guides/japan/tokyo/',
  sourceType: 'html',
  region: 'japan',
  isActive: true,
  isUserAdded: false,
  addedByUid: null,
  lastScrapedAt: null,
  createdAt: Timestamp.now(),
};

// A source Alice added via the registerSource callable.
const aliceSource = {
  ...baseSource,
  name: 'Alice Meetup',
  url: 'https://www.meetup.com/alice-group/events/ical',
  sourceType: 'rss',
  isUserAdded: true,
  addedByUid: ALICE,
};

const baseUserDoc = {
  displayName: null,
  favoriteEventIds: [],
  prefs: {
    city: '',
    danceStyles: [],
    eventTypes: [],
    theme: 'system',
    language: null,
  },
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('events/{eventId}', () => {
  test('unauthenticated client can read an event', async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
    await assertSucceeds(getDoc(doc(anonDb(), `events/${EVENT_ID}`)));
  });

  test('unauthenticated client can list events', async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
    await assertSucceeds(getDocs(collection(anonDb(), 'events')));
  });

  test('authenticated client cannot create an event', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `events/${EVENT_ID}`), baseEvent),
    );
  });

  test('authenticated client cannot update an event', async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
    await assertFails(
      updateDoc(doc(aliceDb(), `events/${EVENT_ID}`), {title: 'Hacked'}),
    );
  });

  test('authenticated client cannot delete an event', async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
    await assertFails(deleteDoc(doc(aliceDb(), `events/${EVENT_ID}`)));
  });

  test('unauthenticated client cannot write an event', async () => {
    await assertFails(
      setDoc(doc(anonDb(), `events/${EVENT_ID}`), baseEvent),
    );
  });
});

describe('events/{eventId}/attendance/{uid}', () => {
  const alicePath = `events/${EVENT_ID}/attendance/${ALICE}`;
  const validAttendance = {status: 'going', updatedAt: Timestamp.now()};

  beforeEach(async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
  });

  test('owner can create their own attendance with status going', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), alicePath), validAttendance),
    );
  });

  test('owner can create with status interested', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), alicePath), {
        ...validAttendance,
        status: 'interested',
      }),
    );
  });

  test('owner can update their own attendance', async () => {
    await seed(alicePath, validAttendance);
    await assertSucceeds(
      updateDoc(doc(aliceDb(), alicePath), {
        status: 'interested',
        updatedAt: Timestamp.now(),
      }),
    );
  });

  test('another user cannot write to someone else\'s attendance doc',
    async () => {
      await assertFails(
        setDoc(doc(bobDb(), alicePath), validAttendance),
      );
    });

  test('unauthenticated client cannot write attendance', async () => {
    await assertFails(
      setDoc(doc(anonDb(), alicePath), validAttendance),
    );
  });

  test('rejects an invalid status value', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), alicePath), {
        ...validAttendance,
        status: 'maybe',
      }),
    );
  });

  test('rejects extra keys beyond status/updatedAt', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), alicePath), {
        ...validAttendance,
        plusOnes: 5,
      }),
    );
  });

  test('rejects a non-timestamp updatedAt', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), alicePath), {
        ...validAttendance,
        updatedAt: 'banana',
      }),
    );
  });

  test('rejects a missing updatedAt', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), alicePath), {status: 'going'}),
    );
  });

  test('attendance is publicly readable', async () => {
    await seed(alicePath, validAttendance);
    await assertSucceeds(getDoc(doc(anonDb(), alicePath)));
  });

  test('owner can delete their own attendance', async () => {
    await seed(alicePath, validAttendance);
    await assertSucceeds(deleteDoc(doc(aliceDb(), alicePath)));
  });

  test('another user cannot delete it', async () => {
    await seed(alicePath, validAttendance);
    await assertFails(deleteDoc(doc(bobDb(), alicePath)));
  });
});

describe('sources/{sourceId}', () => {
  const DEFAULT_ID = 'salsavida-tokyo';
  const ALICE_SRC_ID = 'alice-source';

  beforeEach(async () => {
    await seed(`sources/${DEFAULT_ID}`, baseSource);
    await seed(`sources/${ALICE_SRC_ID}`, aliceSource);
  });

  test('sources are publicly readable', async () => {
    await assertSucceeds(getDoc(doc(anonDb(), `sources/${DEFAULT_ID}`)));
  });

  test('client create is denied even when authenticated (callable only)',
    async () => {
      await assertFails(
        setDoc(doc(aliceDb(), 'sources/new-source'), {
          ...aliceSource,
          url: 'https://example.com/feed.ics',
        }),
      );
    });

  test('owner can toggle isActive on their own source', async () => {
    await assertSucceeds(
      updateDoc(doc(aliceDb(), `sources/${ALICE_SRC_ID}`), {
        isActive: false,
      }),
    );
  });

  test('another user cannot toggle isActive', async () => {
    await assertFails(
      updateDoc(doc(bobDb(), `sources/${ALICE_SRC_ID}`), {
        isActive: false,
      }),
    );
  });

  test('nobody can toggle a seeded default (addedByUid null)', async () => {
    await assertFails(
      updateDoc(doc(aliceDb(), `sources/${DEFAULT_ID}`), {
        isActive: false,
      }),
    );
  });

  test('rejects a non-boolean isActive', async () => {
    await assertFails(
      updateDoc(doc(aliceDb(), `sources/${ALICE_SRC_ID}`), {
        isActive: 'yes',
      }),
    );
  });

  test('owner cannot update any field other than isActive', async () => {
    await assertFails(
      updateDoc(doc(aliceDb(), `sources/${ALICE_SRC_ID}`), {
        name: 'Renamed',
      }),
    );
  });

  test('owner cannot update isActive together with another field',
    async () => {
      await assertFails(
        updateDoc(doc(aliceDb(), `sources/${ALICE_SRC_ID}`), {
          isActive: false,
          url: 'https://evil.example.com/',
        }),
      );
    });

  test('owner can delete their own user-added source', async () => {
    await assertSucceeds(
      deleteDoc(doc(aliceDb(), `sources/${ALICE_SRC_ID}`)),
    );
  });

  test('another user cannot delete it', async () => {
    await assertFails(deleteDoc(doc(bobDb(), `sources/${ALICE_SRC_ID}`)));
  });

  test('a seeded default (isUserAdded false) cannot be deleted', async () => {
    // Even by a user who somehow matched addedByUid — pin one to Alice.
    await seed('sources/pinned-default', {
      ...baseSource,
      addedByUid: ALICE,
      isUserAdded: false,
    });
    await assertFails(deleteDoc(doc(aliceDb(), 'sources/pinned-default')));
  });

  describe('scrapeLogs subcollection', () => {
    const logPath = `sources/${DEFAULT_ID}/scrapeLogs/log1`;
    const validLog = {
      status: 'success',
      eventsFound: 10,
      eventsAdded: 3,
      errorMessage: null,
      durationMs: 1200,
      createdAt: Timestamp.now(),
    };

    test('scrapeLogs are publicly readable', async () => {
      await seed(logPath, validLog);
      await assertSucceeds(getDoc(doc(anonDb(), logPath)));
    });

    test('clients cannot write scrapeLogs', async () => {
      await assertFails(setDoc(doc(aliceDb(), logPath), validLog));
    });

    test('clients cannot delete scrapeLogs', async () => {
      await seed(logPath, validLog);
      await assertFails(deleteDoc(doc(aliceDb(), logPath)));
    });
  });
});

describe('users/{uid}', () => {
  test('owner can create their own doc with a valid shape', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}`), baseUserDoc),
    );
  });

  test('owner can read their own doc', async () => {
    await seed(`users/${ALICE}`, baseUserDoc);
    await assertSucceeds(getDoc(doc(aliceDb(), `users/${ALICE}`)));
  });

  test('another user cannot read it', async () => {
    await seed(`users/${ALICE}`, baseUserDoc);
    await assertFails(getDoc(doc(bobDb(), `users/${ALICE}`)));
  });

  test('an unauthenticated client cannot read it', async () => {
    await seed(`users/${ALICE}`, baseUserDoc);
    await assertFails(getDoc(doc(anonDb(), `users/${ALICE}`)));
  });

  test('another user cannot write it', async () => {
    await assertFails(
      setDoc(doc(bobDb(), `users/${ALICE}`), baseUserDoc),
    );
  });

  test('owner cannot delete their own doc (adminDeleteUser only)', async () => {
    await seed(`users/${ALICE}`, baseUserDoc);
    await assertFails(deleteDoc(doc(aliceDb(), `users/${ALICE}`)));
  });

  test('owner can update favorites and prefs', async () => {
    await seed(`users/${ALICE}`, baseUserDoc);
    await assertSucceeds(
      updateDoc(doc(aliceDb(), `users/${ALICE}`), {
        favoriteEventIds: [EVENT_ID],
        'prefs.city': 'Tokyo',
        updatedAt: Timestamp.now(),
      }),
    );
  });

  test('rejects fields outside the whitelist', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...baseUserDoc,
        isAdmin: true,
      }),
    );
  });

  test('rejects a non-list favoriteEventIds', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...baseUserDoc,
        favoriteEventIds: 'evt1',
      }),
    );
  });

  test('rejects more than 1000 favorites', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...baseUserDoc,
        favoriteEventIds: Array.from({length: 1001}, (_, i) => `e${i}`),
      }),
    );
  });

  test('allows exactly 1000 favorites (boundary)', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...baseUserDoc,
        favoriteEventIds: Array.from({length: 1000}, (_, i) => `e${i}`),
      }),
    );
  });

  test('rejects a non-map prefs', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        ...baseUserDoc,
        prefs: 'dark',
      }),
    );
  });
});

// ─── Admin (custom claim admin: true) ────────────────────────────────────────

describe('admin powers', () => {
  const ADMIN = 'carol-admin';

  function adminDb() {
    return testEnv.authenticatedContext(ADMIN, { admin: true }).firestore();
  }

  beforeEach(async () => {
    await seed(`events/${EVENT_ID}`, baseEvent);
    await seed('sources/user-src', {
      name: 'User Source', url: 'https://example.com/a', sourceType: 'html',
      region: 'japan', isActive: true, isUserAdded: true, addedByUid: BOB,
      lastScrapedAt: null, createdAt: Timestamp.now(),
    });
    await seed('sources/seeded-src', {
      name: 'Seeded Source', url: 'https://example.com/b', sourceType: 'rss',
      region: 'japan', isActive: true, isUserAdded: false, addedByUid: null,
      lastScrapedAt: null, createdAt: Timestamp.now(),
    });
    await seed(`events/${EVENT_ID}/attendance/${BOB}`, {
      status: 'going', updatedAt: Timestamp.now(),
    });
    await seed('sources/seeded-src/scrapeLogs/log1', {
      status: 'success', eventsFound: 3, eventsAdded: 1,
      errorMessage: null, durationMs: 100, createdAt: Timestamp.now(),
    });
  });

  test('admin can cancel (update) an event', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), `events/${EVENT_ID}`), { isCancelled: true }),
    );
  });

  test('admin can delete an event; normal user cannot', async () => {
    await assertFails(deleteDoc(doc(aliceDb(), `events/${EVENT_ID}`)));
    await assertSucceeds(deleteDoc(doc(adminDb(), `events/${EVENT_ID}`)));
  });

  test('admin can toggle any source isActive', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'sources/user-src'), { isActive: false }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'sources/seeded-src'), { isActive: false }),
    );
  });

  test('admin can delete a user-added source but not a seeded default', async () => {
    await assertSucceeds(deleteDoc(doc(adminDb(), 'sources/user-src')));
    await assertFails(deleteDoc(doc(adminDb(), 'sources/seeded-src')));
  });

  test('admin can read another user\'s doc; normal user cannot', async () => {
    await seed(`users/${BOB}`, {
      displayName: null, favoriteEventIds: [], prefs: {},
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    await assertFails(getDoc(doc(aliceDb(), `users/${BOB}`)));
    await assertSucceeds(getDoc(doc(adminDb(), `users/${BOB}`)));
  });

  test('collection-group attendance readable by admin only', async () => {
    const { collectionGroup } = require('firebase/firestore');
    await assertSucceeds(getDocs(collectionGroup(adminDb(), 'attendance')));
    await assertFails(getDocs(collectionGroup(aliceDb(), 'attendance')));
  });

  test('collection-group scrapeLogs readable by admin only', async () => {
    const { collectionGroup } = require('firebase/firestore');
    await assertSucceeds(getDocs(collectionGroup(adminDb(), 'scrapeLogs')));
    await assertFails(getDocs(collectionGroup(aliceDb(), 'scrapeLogs')));
  });
});

// Regression: a fresh user's first write from the Preferences screen sends
// only {prefs, createdAt, updatedAt} (merge) — no favoriteEventIds key yet.
// This was denied by the original always-required field checks.
describe('users first write', () => {
  test('prefs-only first write succeeds', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        prefs: { city: 'Tokyo' },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }),
    );
  });

  test('junk keys still rejected on first write', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), `users/${ALICE}`), {
        prefs: {}, isAdmin: true,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});
