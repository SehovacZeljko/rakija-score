/**
 * Seed script: creates 200 test producers in Firestore.
 *
 * Usage:
 *   SEED_EMAIL=admin@example.com SEED_PASSWORD=yourpassword node scripts/seed-producers.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
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

// ── Data pools ─────────────────────────────────────────────────────────────────
const distilleryPrefixes = [
  'Destilerija', 'Vinarija', 'Voćnjak', 'Seljačka destilerija',
  'Porodična destilerija', 'Etno destilerija', 'Stara destilerija',
  'Gorska destilerija', 'Planinska destilerija', 'Šumska destilerija',
];

const placeNames = [
  'Morava', 'Zlatibor', 'Kopaonik', 'Fruška Gora', 'Šumadija',
  'Tara', 'Rtanj', 'Stara Planina', 'Rudnik', 'Avala',
  'Vršac', 'Jagodina', 'Leskovac', 'Vranje', 'Zaječar',
  'Negotin', 'Kladovo', 'Pirot', 'Niš', 'Prokuplje',
  'Kruševac', 'Paraćin', 'Čačak', 'Užice', 'Požega',
  'Ivanjica', 'Arilje', 'Nova Varoš', 'Priboj', 'Prijepolje',
  'Tutin', 'Novi Pazar', 'Raška', 'Vrnjačka Banja', 'Aranđelovac',
  'Topola', 'Mladenovac', 'Smederevo', 'Požarevac', 'Petrovac',
  'Despotovac', 'Knjaževac', 'Bela Palanka', 'Surdulica', 'Vlasina',
];

const firstNames = [
  'Marko', 'Nikola', 'Jovan', 'Stefan', 'Milan',
  'Dragan', 'Zoran', 'Dejan', 'Miloš', 'Aleksa',
  'Vladimir', 'Nemanja', 'Bojan', 'Goran', 'Siniša',
  'Ivana', 'Milica', 'Ana', 'Jelena', 'Dragana',
  'Snežana', 'Vesna', 'Danijela', 'Maja', 'Gordana',
];

const lastNames = [
  'Jovanović', 'Petrović', 'Nikolić', 'Đorđević', 'Stojanović',
  'Ilić', 'Stanković', 'Marković', 'Đokić', 'Savić',
  'Milosavljević', 'Milošević', 'Tomić', 'Kovačević', 'Lazić',
  'Vasić', 'Simić', 'Vukić', 'Branković', 'Ranđelović',
  'Nedeljković', 'Živković', 'Pejović', 'Vuković', 'Radović',
];

const streets = [
  'Ulica oslobođenja', 'Svetosavska ulica', 'Knez Mihailova', 'Cara Lazara',
  'Vojvode Putnika', 'Nemanjina', 'Kralja Petra', 'Bulevar oslobođenja',
  'Miloša Obrenovića', 'Ive Andrića', 'Vuka Stefanovića Karadžića',
  'Nikole Pašića', 'Dositejeva', 'Zmaj Jovina', 'Braće Radić',
];

const regions = [
  'Šumadija', 'Vojvodina', 'Podunavlje', 'Braničevo', 'Zaječar',
  'Borski okrug', 'Pirotski okrug', 'Jablanički okrug', 'Pčinjski okrug',
  'Raška', 'Moravički okrug', 'Zlatibor', 'Mačvanski okrug',
];

const countries = [
  'Serbia', 'Serbia', 'Serbia', 'Serbia', 'Serbia',
  'Serbia', 'Serbia', 'Serbia', 'Serbia', 'Serbia',
  'Bosnia and Herzegovina', 'Bosnia and Herzegovina',
  'North Macedonia',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/š/g, 's').replace(/đ/g, 'dj').replace(/č/g, 'c')
    .replace(/ć/g, 'c').replace(/ž/g, 'z').replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function randomPhone() {
  const prefix = pick(['61', '62', '63', '64', '65', '66']);
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `+381 ${prefix} ${String(number).slice(0, 3)} ${String(number).slice(3)}`;
}

function generateProducer(index) {
  const place = pick(placeNames);
  const prefix = pick(distilleryPrefixes);
  const name = `${prefix} ${place} ${index + 1}`;
  const slug = slugify(name);
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const streetNumber = Math.floor(Math.random() * 150) + 1;
  const country = pick(countries);

  return {
    name,
    contactPerson: `${firstName} ${lastName}`,
    email: `kontakt@${slug}.rs`,
    phone: randomPhone(),
    address: `${pick(streets)} ${streetNumber}`,
    region: pick(regions),
    country,
    createdAt: Timestamp.now(),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
const PRODUCER_COUNT = 200;
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

  const producersCollection = collection(db, 'producers');
  let created = 0;

  for (let batchStart = 0; batchStart < PRODUCER_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, PRODUCER_COUNT);
    const batch = writeBatch(db);

    for (let index = batchStart; index < batchEnd; index++) {
      const newDocRef = doc(producersCollection);
      const producerData = generateProducer(index);
      batch.set(newDocRef, { producerId: newDocRef.id, ...producerData });
    }

    await batch.commit();
    created += batchEnd - batchStart;
    console.log(`  Committed batch: ${created}/${PRODUCER_COUNT} producers`);
  }

  console.log(`\n✓ Created ${created} producers`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
