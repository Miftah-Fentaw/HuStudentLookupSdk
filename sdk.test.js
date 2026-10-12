const test = require('node:test');
const assert = require('node:assert');
const { HuStdLookupSdk, DormSDK, FILTER_FIELDS } = require('./src');
const DefaultHuStdLookupSdk = require('./src');

test('exports both HuStdLookupSdk and legacy DormSDK alias', () => {
  assert.strictEqual(HuStdLookupSdk.name, 'HuStdLookupSdk');
  assert.strictEqual(DormSDK, HuStdLookupSdk);
  assert.strictEqual(DefaultHuStdLookupSdk, HuStdLookupSdk);
  assert.ok(Array.isArray(FILTER_FIELDS));
});

const sdk = HuStdLookupSdk.load();

test('getById is case/space-insensitive', () => {
  assert.strictEqual(sdk.getById(' 1175/15 ').name, 'Adane Absaye Ayle');
  assert.strictEqual(sdk.getById('UGPR1175/15').name, 'Adane Absaye Ayle'); // prefix ignored
  assert.strictEqual(sdk.getById('nope'), null);
});

test('name prefix search, all words must match', () => {
  const r = sdk.search({ name: 'abdurezak wash' });
  assert.ok(r.total >= 1 && r.results[0].id === '1137/15');
});

test('filters combine and match brute force', () => {
  const q = { dept: 'law', campus: 'main', sex: 'F' };
  const brute = sdk.records.filter((r) => r.dept.toLowerCase() === 'law' && r.campus === 'Main' && r.sex === 'F');
  assert.strictEqual(sdk.search({ ...q, limit: 1e6 }).total, brute.length);
});

test('array = OR, pagination', () => {
  const both = sdk.search({ campus: ['Hit', 'Harar'], limit: 5, offset: 10 });
  assert.strictEqual(both.total, 2650 + 2575);
  assert.strictEqual(both.results.length, 5);
});

test('vet case variants are merged', () => {
  assert.strictEqual(sdk.search({ campus: 'vet' }).total, 186);
});

test('no match', () => {
  assert.deepStrictEqual(sdk.search({ name: 'zzzzqq' }), { total: 0, results: [] });
});

test('dormmates: ids of same-room students, excluding self, all resolvable', () => {
  const s = sdk.getById('1175/15');
  assert.ok(Array.isArray(s.dormmates) && s.dormmates.length > 0);
  assert.ok(!s.dormmates.includes(s.id));
  for (const id of s.dormmates) {
    const m = sdk.getById(id);
    assert.ok(m && m.campus === s.campus && m.building === s.building && m.dorm === s.dorm);
  }
  assert.ok(sdk.getById('0493/15#2')); // duplicate-ID row still reachable by its key
});

test('getDormmates helper resolves roommate student records', () => {
  const mates = sdk.getDormmates('1175/15');
  assert.ok(Array.isArray(mates) && mates.length > 0);
  const s = sdk.getById('1175/15');
  assert.strictEqual(mates.length, s.dormmates.length);
  for (const mate of mates) {
    assert.strictEqual(mate.campus, s.campus);
    assert.strictEqual(mate.building, s.building);
    assert.strictEqual(mate.dorm, s.dorm);
    assert.notStrictEqual(mate.id, s.id);
  }
  assert.deepStrictEqual(sdk.getDormmates('invalid_id'), []);
});

test('facets returns counts and distinct values', () => {
  const campuses = sdk.facets('campus');
  assert.ok(campuses.length >= 4);
  const campusNames = campuses.map((c) => c.value.toLowerCase());
  assert.ok(campusNames.includes('harar'));
  assert.ok(campusNames.includes('hit'));
  assert.ok(campusNames.includes('main'));
});

test('load and constructor use predefined dataset from src/data.json without arguments', () => {
  const loaded = HuStdLookupSdk.load();
  assert.strictEqual(loaded.size, 12322);
  const direct = new HuStdLookupSdk();
  assert.strictEqual(direct.size, 12322);
});

test('lookups and roommates for Dagim Alemu and Elbetel Taye match expected data', () => {
  const dagim = sdk.getById('0276/15');
  assert.ok(dagim);
  assert.strictEqual(dagim.name, 'Dagim Alemu Alolo');
  assert.strictEqual(dagim.dept, 'SWE');
  assert.strictEqual(dagim.campus, 'Main');
  assert.strictEqual(dagim.dorm, '120');

  const dagimMates = sdk.getDormmates('0276/15');
  assert.strictEqual(dagimMates.length, 3);
  assert.ok(dagimMates.every((m) => m.dorm === '120' && m.building === 'SAT 4A'));

  const elbetel = sdk.getById('1228/18');
  assert.ok(elbetel);
  assert.strictEqual(elbetel.name, 'Elbetel Taye Ladankilet');
  assert.strictEqual(elbetel.dept, 'Meng');
  assert.strictEqual(elbetel.campus, 'Hit');
  assert.strictEqual(elbetel.dorm, '44');

  const elbetelMates = sdk.getDormmates('1228/18');
  assert.strictEqual(elbetelMates.length, 5);
  assert.ok(elbetelMates.every((m) => m.dorm === '44' && m.building === 'Block LA'));
});

test('getByIds returns records or null in the same order', () => {
  const rows = sdk.getByIds(['0276/15', 'UGPR1228/18', 'nope', ' 1175/15 ']);
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[0].name, 'Dagim Alemu Alolo');
  assert.strictEqual(rows[1].name, 'Elbetel Taye Ladankilet');
  assert.strictEqual(rows[2], null);
  assert.strictEqual(rows[3].name, 'Adane Absaye Ayle');
  assert.deepStrictEqual(sdk.getByIds('not-an-array'), []);
});

test('validateId normalizes input and reports clear reasons', () => {
  const ok = sdk.validateId('  UGPR0276/15 ');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.normalized, '0276/15');
  assert.strictEqual(ok.reason, null);
  assert.strictEqual(ok.student.name, 'Dagim Alemu Alolo');

  assert.strictEqual(sdk.validateId('').reason, 'empty');
  assert.strictEqual(sdk.validateId('not-an-id').reason, 'invalid_format');
  assert.strictEqual(sdk.validateId('9999/99').reason, 'not_found');
});

test('default search ignores typos; fuzzy opt-in finds them', () => {
  assert.deepStrictEqual(sdk.search({ name: 'dagm alemu' }), { total: 0, results: [] });
  const fuzzy = sdk.search({ name: 'dagm alemu', fuzzy: true });
  assert.ok(fuzzy.total >= 1);
  assert.ok(fuzzy.results.some((r) => r.id === '0276/15'));
});

test('search sortBy and page do not change default name order', () => {
  const plain = sdk.search({ campus: 'VET', limit: 5 });
  const explicit = sdk.search({ campus: 'VET', sortBy: 'name', sortDir: 'asc', limit: 5 });
  assert.deepStrictEqual(explicit.results.map((r) => r.id), plain.results.map((r) => r.id));

  const byDept = sdk.search({ campus: 'VET', sortBy: 'dept', sortDir: 'asc', limit: 20 });
  for (let i = 1; i < byDept.results.length; i++) {
    assert.ok(byDept.results[i - 1].dept.localeCompare(byDept.results[i].dept, undefined, { sensitivity: 'base' }) <= 0);
  }

  const page1 = sdk.search({ campus: 'Hit', page: 1, pageSize: 3 });
  const page2 = sdk.search({ campus: 'Hit', page: 2, pageSize: 3 });
  assert.strictEqual(page1.results.length, 3);
  assert.strictEqual(page2.results.length, 3);
  assert.notStrictEqual(page1.results[0].id, page2.results[0].id);
  assert.strictEqual(page1.total, page2.total);
});

test('suggest returns name prefix matches and campus facets', () => {
  const names = sdk.suggest('dagim alemu', { limit: 5 });
  assert.ok(names.length >= 1);
  assert.ok(names.some((r) => r.id === '0276/15'));
  assert.ok(names.length <= 5);

  const campuses = sdk.suggest('ma', { field: 'campus', limit: 5 });
  assert.ok(campuses.some((c) => /main/i.test(c.value)));
});

test('stats groups counts and respects filters', () => {
  const byCampus = sdk.stats({ groupBy: 'campus' });
  assert.ok(byCampus.length >= 4);
  const main = byCampus.find((r) => r.campus === 'Main');
  assert.ok(main && main.count > 0);
  assert.strictEqual(
    byCampus.reduce((n, r) => n + r.count, 0),
    sdk.size
  );

  const filtered = sdk.stats({ groupBy: ['campus', 'sex'], campus: 'Hit' });
  assert.ok(filtered.every((r) => r.campus === 'Hit'));
  assert.strictEqual(
    filtered.reduce((n, r) => n + r.count, 0),
    sdk.search({ campus: 'Hit', limit: 1 }).total
  );
});