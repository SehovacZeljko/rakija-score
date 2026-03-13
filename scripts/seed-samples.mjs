/**
 * Seed script: creates 400 test samples assigned to random producers and random
 * categories from the active/staging event.
 *
 * Prerequisites:
 *   - At least one event with status 'staging' or 'active' must exist
 *   - That event must have at least one category
 *   - Producers should already exist (run seed-producers.mjs first)
 *
 * Usage:
 *   SEED_EMAIL=admin@example.com SEED_PASSWORD=yourpassword node scripts/seed-samples.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

// ── Firebase config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyCanp6NueHAx8_YPuDB4mlLS06fzVLv5lE',
  authDomain: 'rakija-score.firebaseapp.com',
  projectId: 'rakija-score',
  storageBucket: 'rakija-score.firebasestorage.app',
  messagingSenderId: '100389550388',
  appId: '1:100389550388:web:849dfc6cfa4156acd88d61',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomAlcohol() {
  // Random float between 35.0 and 55.0 with 1 decimal place
  return Math.round((35 + Math.random() * 20) * 10) / 10;
}

function randomYear() {
  return 2020 + Math.floor(Math.random() * 5); // 2020–2024
}

// ── Main ───────────────────────────────────────────────────────────────────────
const SAMPLE_COUNT = 400;
const BATCH_SIZE = 500;

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  if (!email || !password) {
    console.error('Error: SEED_EMAIL and SEED_PASSWORD environment variables are required.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}`);

  // ── Step 1: Fetch all producer IDs ──────────────────────────────────────────
  console.log('\nFetching producers...');
  const producersSnapshot = await getDocs(collection(db, 'producers'));
  if (producersSnapshot.empty) {
    console.error('Error: No producers found. Run seed-producers.mjs first.');
    process.exit(1);
  }
  const producerIds = producersSnapshot.docs.map((document) => document.id);
  console.log(`  Found ${producerIds.length} producers`);

  // ── Step 2: Find target event (staging or active) ───────────────────────────
  console.log('\nFetching events...');
  const eventsQuery = query(
    collection(db, 'events'),
    where('status', 'in', ['staging', 'active'])
  );
  const eventsSnapshot = await getDocs(eventsQuery);

  if (eventsSnapshot.empty) {
    console.error('Error: No staging or active event found. Create an event first.');
    process.exit(1);
  }

  if (eventsSnapshot.docs.length > 1) {
    console.warn(`  Warning: ${eventsSnapshot.docs.length} staging/active events found. Using the first one.`);
  }

  const targetEvent = eventsSnapshot.docs[0].data();
  const targetEventId = eventsSnapshot.docs[0].id;
  console.log(`  Using event: "${targetEvent.name}" (${targetEvent.year}) [${targetEvent.status}] — id: ${targetEventId}`);

  // ── Step 3: Fetch categories for the event ──────────────────────────────────
  console.log('\nFetching categories...');
  const categoriesQuery = query(
    collection(db, 'categories'),
    where('eventId', '==', targetEventId)
  );
  const categoriesSnapshot = await getDocs(categoriesQuery);

  if (categoriesSnapshot.empty) {
    console.error(`Error: No categories found for event "${targetEvent.name}". Create categories first.`);
    process.exit(1);
  }

  const categoryIds = categoriesSnapshot.docs.map((document) => document.id);
  console.log(`  Found ${categoryIds.length} categories`);

  // ── Step 4: Find highest existing sampleCode for this event ─────────────────
  console.log('\nChecking existing sample codes...');
  const existingSamplesQuery = query(
    collection(db, 'samples'),
    where('categoryId', 'in', categoryIds)
  );
  const existingSamplesSnapshot = await getDocs(existingSamplesQuery);

  let startCode = 1001;
  if (!existingSamplesSnapshot.empty) {
    const existingCodes = existingSamplesSnapshot.docs
      .map((document) => parseInt(document.data().sampleCode, 10))
      .filter((code) => !isNaN(code));
    if (existingCodes.length > 0) {
      startCode = Math.max(...existingCodes) + 1;
    }
  }
  console.log(`  Starting sample codes from: ${startCode}`);

  // ── Step 5: Generate and write samples ──────────────────────────────────────
  console.log(`\nCreating ${SAMPLE_COUNT} samples...`);

  // Track per-category order counters (start after existing counts)
  const categoryOrderCounters = {};
  for (const categoryId of categoryIds) {
    categoryOrderCounters[categoryId] = 0;
  }
  for (const existingDoc of existingSamplesSnapshot.docs) {
    const existingCategoryId = existingDoc.data().categoryId;
    if (categoryOrderCounters[existingCategoryId] !== undefined) {
      categoryOrderCounters[existingCategoryId]++;
    }
  }

  const samplesCollection = collection(db, 'samples');
  let created = 0;

  for (let batchStart = 0; batchStart < SAMPLE_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, SAMPLE_COUNT);
    const batch = writeBatch(db);

    for (let index = batchStart; index < batchEnd; index++) {
      const categoryId = pick(categoryIds);
      categoryOrderCounters[categoryId]++;

      const newDocRef = doc(samplesCollection);
      batch.set(newDocRef, {
        sampleId: newDocRef.id,
        producerId: pick(producerIds),
        categoryId,
        sampleCode: String(startCode + index),
        year: randomYear(),
        alcoholStrength: randomAlcohol(),
        order: categoryOrderCounters[categoryId],
        createdAt: Timestamp.now(),
      });
    }

    await batch.commit();
    created += batchEnd - batchStart;
    console.log(`  Committed batch: ${created}/${SAMPLE_COUNT} samples`);
  }

  console.log(`\n✓ Created ${created} samples for event "${targetEvent.name}"`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
