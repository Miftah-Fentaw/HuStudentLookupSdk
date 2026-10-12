'use strict';


/**
 * HuStdLookupSdk - high-performance lookups and search over Haramaya University
 * student placement and dormitory records.
 *
 * Performance features:
 *   - getById      -> Map<id, record> (hash table), O(1)
 *   - filters      -> Map<value, sortedRowIds[]> per field (inverted index)
 *   - name search  -> Map<token, sortedRowIds[]> + sorted token array
 *                     (binary search finds all tokens sharing a prefix)
 *   - fuzzy name   -> lazy BK-tree over unique tokens (opt-in only)
 *   - combining    -> intersect sorted arrays, smallest first
 */

const FILTER_FIELDS = ['sex', 'dept', 'campus', 'building', 'year', 'dorm'];
const SORT_FIELDS = new Set(['name', 'id', ...FILTER_FIELDS]);
const ID_SHAPE = /^\d+\/\d+(?:#\S+)?$/i;

const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
// IDs are stored without the "UGPR" prefix; strip it from user input too.
const normId = (v) => norm(v).replace(/^ugpr/, '');
const tokenize = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

// First index in sorted `arr` whose value is >= x.
function lowerBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// Intersect two sorted int arrays; binary-searches the larger one when sizes differ a lot.
function intersect(a, b) {
  if (a.length > b.length) [a, b] = [b, a];
  const out = [];
  if (b.length > a.length * 16) {
    let from = 0;
    for (let i = 0; i < a.length; i++) {
      from = lowerBound(b, a[i]);
      if (from === b.length) break;
      if (b[from] === a[i]) out.push(a[i]);
    }
    return out;
  }
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

// Union of many sorted posting lists -> one sorted list (bitmap keeps it O(n + k)).
function union(lists, size) {
  if (lists.length === 1) return lists[0];
  const mark = new Uint8Array(size);
  for (const l of lists) for (let i = 0; i < l.length; i++) mark[l[i]] = 1;
  const out = [];
  for (let i = 0; i < size; i++) if (mark[i]) out.push(i);
  return out;
}

/** Exact Levenshtein distance (needed for correct BK-tree edges). */
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Burkhard-Keller tree over short name tokens for opt-in fuzzy matching. */
class BKTree {
  constructor() {
    this.root = null;
  }

  add(word) {
    if (!this.root) {
      this.root = { word, children: new Map() };
      return;
    }
    let node = this.root;
    for (;;) {
      const d = editDistance(word, node.word);
      if (d === 0) return;
      const next = node.children.get(d);
      if (!next) {
        node.children.set(d, { word, children: new Map() });
        return;
      }
      node = next;
    }
  }

  /** @returns {Array<{word:string, dist:number}>} */
  query(word, maxDist) {
    const out = [];
    if (!this.root) return out;
    const stack = [this.root];
    while (stack.length) {
      const node = stack.pop();
      const d = editDistance(word, node.word);
      if (d <= maxDist) out.push({ word: node.word, dist: d });
      for (const [edge, child] of node.children) {
        if (edge >= d - maxDist && edge <= d + maxDist) stack.push(child);
      }
    }
    return out;
  }
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

class HuStdLookupSdk {
  /**
   * @param {{students: Object<string, {id:string,name:string,sex:string,dept:string,campus:string,building:string,dorm:string,year:string,dormmates?:string[]}>,
   *          campuses?: string[], departments?: string[]}|Array<object>} [data]
   */
  constructor(data = require('./data.json')) {
    const isArr = Array.isArray(data);
    const entries = isArr ? data.map((r) => [r.id, r]) : Object.entries(data.students || {});
    const records = entries.map((e) => e[1]);
    this.byId = new Map();
    // key -> record itself. Keys are unique, so dormmates ids like "0493/15#S1414" resolve too.
    // Duplicate real IDs: the first one keeps the plain id.
    for (const [key, r] of entries) {
      const k = normId(key);
      if (k && !this.byId.has(k)) this.byId.set(k, r);
    }
    records.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // search results come back A-Z by name
    this.records = records;
    this.size = records.length;
    this.fieldIndex = {};
    for (const f of FILTER_FIELDS) this.fieldIndex[f] = new Map();
    this.tokenIndex = new Map();

    records.forEach((r, i) => {
      for (const f of FILTER_FIELDS) {
        const k = norm(r[f]);
        const m = this.fieldIndex[f];
        const list = m.get(k);
        list ? list.push(i) : m.set(k, [i]); // rows visited in order => lists stay sorted
      }

      for (const t of new Set(tokenize(r.name))) {
        const list = this.tokenIndex.get(t);
        list ? list.push(i) : this.tokenIndex.set(t, [i]);
      }
    });
    this.sortedTokens = [...this.tokenIndex.keys()].sort();
    this._bkTree = null; // built lazily on first fuzzy query
    // dropdown lists (from the file when present, otherwise derived)
    this.campuses = (data && data.campuses) || this.facets('campus').map((f) => f.value).sort();
    this.departments = (data && data.departments) || this.facets('dept').map((f) => f.value).sort();
  }

  /**
   * Load SDK with predefined dataset from data.json.
   * @returns {HuStdLookupSdk}
   */
  static load() {
    return new HuStdLookupSdk(require('./data.json'));
  }

  _ensureBKTree() {
    if (this._bkTree) return this._bkTree;
    const tree = new BKTree();
    for (let i = 0; i < this.sortedTokens.length; i++) tree.add(this.sortedTokens[i]);
    this._bkTree = tree;
    return tree;
  }

  /** Prefix posting lists for one name word (existing fast path). */
  _prefixTokenLists(word) {
    const hits = [];
    for (let i = lowerBound(this.sortedTokens, word); i < this.sortedTokens.length; i++) {
      const t = this.sortedTokens[i];
      if (!t.startsWith(word)) break;
      hits.push(this.tokenIndex.get(t));
    }
    return hits;
  }

  /**
   * Token posting lists for one name word.
   * Default: prefix only. With fuzzy: also include BK-tree neighbors (union).
   * Prefix-only path is unchanged when fuzzy is false.
   */
  _tokenListsForWord(word, fuzzy, maxEdits) {
    const prefix = this._prefixTokenLists(word);
    if (!fuzzy) return prefix;
    const dist = Math.max(0, Math.min(2, maxEdits | 0));
    if (!dist || word.length < 2) return prefix;
    const near = this._ensureBKTree().query(word, dist);
    const fuzzyLists = near.map((n) => this.tokenIndex.get(n.word)).filter(Boolean);
    if (!prefix.length) return fuzzyLists;
    if (!fuzzyLists.length) return prefix;
    return prefix.concat(fuzzyLists);
  }

  /**
   * Resolve filter + name criteria to sorted row ids, or null for "all rows".
   * Empty array means no matches.
   * @returns {number[]|null}
   */
  _matchIds(q = {}) {
    const { name, fuzzy = false, maxEdits = 1 } = q;
    const lists = [];

    for (const f of FILTER_FIELDS) {
      if (q[f] == null || q[f] === '') continue;
      const vals = Array.isArray(q[f]) ? q[f] : [q[f]];
      const found = vals.map((v) => this.fieldIndex[f].get(norm(v))).filter(Boolean);
      if (!found.length) return [];
      lists.push(union(found, this.size));
    }

    if (name) {
      for (const word of tokenize(name)) {
        const hits = this._tokenListsForWord(word, !!fuzzy, maxEdits);
        if (!hits.length) return [];
        lists.push(union(hits, this.size));
      }
    }

    if (!lists.length) return null;
    lists.sort((a, b) => a.length - b.length);
    let ids = lists[0];
    for (let i = 1; i < lists.length && ids.length; i++) ids = intersect(ids, lists[i]);
    return ids;
  }

  _resolvePaging(q = {}) {
    let limit = q.limit == null ? 50 : Number(q.limit);
    let offset = q.offset == null ? 0 : Number(q.offset);
    if (q.page != null || q.pageSize != null) {
      const pageSize = q.pageSize == null ? limit : Number(q.pageSize);
      const page = Math.max(1, q.page == null ? 1 : Number(q.page));
      limit = pageSize;
      offset = (page - 1) * pageSize;
    }
    if (!Number.isFinite(limit) || limit < 0) limit = 50;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    return { limit, offset };
  }

  /**
   * O(1) lookup. Case/space-insensitive; a leading "UGPR" is ignored. Returns the record or null.
   * @param {string} id Student ID (e.g. "1175/15" or "UGPR1175/15")
   * @returns {object|null}
   */
  getById(id) {
    return this.byId.get(normId(id)) || null;
  }

  /**
   * Batch lookup. Returns one entry per input id (record or null), same order.
   * @param {string[]} ids
   * @returns {Array<object|null>}
   */
  getByIds(ids) {
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => this.getById(id));
  }

  /**
   * Validate / normalize a student ID for forms and bots.
   * @param {string} id
   * @returns {{ok:boolean, input:string, normalized:string, reason:string|null, student:object|null}}
   */
  validateId(id) {
    const input = id == null ? '' : String(id);
    const normalized = normId(input);
    if (!normalized) {
      return { ok: false, input, normalized: '', reason: 'empty', student: null };
    }
    if (!ID_SHAPE.test(normalized)) {
      return { ok: false, input, normalized, reason: 'invalid_format', student: null };
    }
    const student = this.byId.get(normalized) || null;
    if (!student) {
      return { ok: false, input, normalized, reason: 'not_found', student: null };
    }
    return { ok: true, input, normalized: student.id || normalized, reason: null, student };
  }

  /**
   * Return array of student records for the roommates of the given student ID, excluding self.
   * @param {string} id Student ID
   * @returns {object[]}
   */
  getDormmates(id) {
    const s = this.getById(id);
    if (!s || !Array.isArray(s.dormmates)) return [];
    return s.dormmates.map((mid) => this.getById(mid)).filter(Boolean);
  }

  /**
   * Search by name and/or filters.
   * @param {object} [q={}]
   * @param {string} [q.name]       every word must match the START of a name word ("abd wash")
   * @param {boolean} [q.fuzzy=false]  opt-in typo tolerance (BK-tree, maxEdits)
   * @param {number} [q.maxEdits=1]  used only when fuzzy is true (1 or 2)
   * @param {string|string[]} [q.sex|dept|campus|building|year|dorm]  exact (case-insensitive); array = OR
   * @param {string} [q.sortBy]     name|id|sex|dept|campus|building|year|dorm (default: name order)
   * @param {string} [q.sortDir='asc']  asc|desc
   * @param {number} [q.limit=50]
   * @param {number} [q.offset=0]
   * @param {number} [q.page]       optional 1-based page (sets offset from pageSize/limit)
   * @param {number} [q.pageSize]   optional page size (alias for limit when paging)
   * @returns {{total:number, results:object[]}}
   */
  search(q = {}) {
    const { limit, offset } = this._resolvePaging(q);
    const ids = this._matchIds(q);
    if (Array.isArray(ids) && !ids.length) return { total: 0, results: [] };

    const total = ids ? ids.length : this.size;
    const sortBy = q.sortBy ? String(q.sortBy) : '';
    const sortDir = String(q.sortDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const defaultNameAsc = !sortBy || (sortBy === 'name' && sortDir === 'asc');

    // Fast path: records are already name A-Z; matching id lists preserve that order.
    if (defaultNameAsc) {
      const end = Math.min(total, offset + limit);
      const results = [];
      for (let i = offset; i < end; i++) results.push(this.records[ids ? ids[i] : i]);
      return { total, results };
    }

    if (sortBy && !SORT_FIELDS.has(sortBy)) {
      throw new Error(`Unknown sortBy "${sortBy}". Use one of: ${[...SORT_FIELDS].join(', ')}`);
    }

    const field = sortBy || 'name';
    const matched = new Array(total);
    for (let i = 0; i < total; i++) matched[i] = this.records[ids ? ids[i] : i];
    matched.sort((a, b) => {
      const cmp = compareValues(a[field], b[field]);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return { total, results: matched.slice(offset, offset + limit) };
  }

  /**
   * Autocomplete helper. Prefix match by default; optional fuzzy when prefix misses.
   * @param {string} query
   * @param {{limit?:number, fuzzy?:boolean, maxEdits?:number, field?:string}} [opts]
   * @returns {Array<object|{value:string, count:number}>}
   */
  suggest(query, opts = {}) {
    const limit = opts.limit == null ? 8 : Math.max(0, Number(opts.limit) || 0);
    const fuzzy = !!opts.fuzzy;
    const maxEdits = opts.maxEdits == null ? 1 : opts.maxEdits;
    const field = opts.field ? String(opts.field) : 'name';
    const q = norm(query);

    if (!limit) return [];

    if (field !== 'name') {
      if (!this.fieldIndex[field]) {
        throw new Error(`Unknown field "${field}". Use name or one of: ${FILTER_FIELDS.join(', ')}`);
      }
      const facets = this.facets(field);
      if (!q) return facets.slice(0, limit);
      let out = facets.filter((f) => norm(f.value).startsWith(q));
      if (!out.length && fuzzy && q.length >= 2) {
        const dist = Math.max(0, Math.min(2, maxEdits | 0));
        out = facets
          .map((f) => ({ f, d: editDistance(norm(f.value), q) }))
          .filter((x) => x.d <= dist)
          .sort((a, b) => a.d - b.d || b.f.count - a.f.count)
          .map((x) => x.f);
      }
      return out.slice(0, limit);
    }

    if (!q) return this.records.slice(0, limit);

    const words = tokenize(q);
    if (!words.length) return this.records.slice(0, limit);

    // Prefer full query as a name prefix on the first word(s), same AND semantics as search.
    const ids = this._matchIds({ name: q, fuzzy, maxEdits });
    if (!ids || !ids.length) return [];

    const results = [];
    const seen = new Set();
    for (let i = 0; i < ids.length && results.length < limit; i++) {
      const row = ids[i];
      if (seen.has(row)) continue;
      seen.add(row);
      results.push(this.records[row]);
    }
    return results;
  }

  /**
   * Aggregate counts grouped by one or more fields. Optional filters match search().
   * @param {object} [q={}]
   * @param {string|string[]} q.groupBy  e.g. 'campus' or ['campus','sex']
   * @param {string|string[]} [q.sex|dept|campus|building|year|dorm]
   * @param {string} [q.name]
   * @param {boolean} [q.fuzzy]
   * @returns {Array<Object>}
   */
  stats(q = {}) {
    const raw = q.groupBy;
    const groupBy = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .map((f) => String(f))
      .filter(Boolean);
    if (!groupBy.length) {
      throw new Error(`groupBy is required. Use one or more of: ${FILTER_FIELDS.join(', ')}`);
    }
    for (const f of groupBy) {
      if (!this.fieldIndex[f]) {
        throw new Error(`Unknown groupBy field "${f}". Use one of: ${FILTER_FIELDS.join(', ')}`);
      }
    }

    const ids = this._matchIds(q);
    if (Array.isArray(ids) && !ids.length) return [];

    const counts = new Map();
    const display = new Map();
    const total = ids ? ids.length : this.size;

    for (let i = 0; i < total; i++) {
      const r = this.records[ids ? ids[i] : i];
      const keyParts = groupBy.map((f) => norm(r[f]));
      const key = keyParts.join('\0');
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!display.has(key)) {
        display.set(key, Object.fromEntries(groupBy.map((f) => [f, r[f]])));
      }
    }

    return [...counts.entries()]
      .map(([key, count]) => ({ ...display.get(key), count }))
      .sort((a, b) => b.count - a.count || compareValues(a[groupBy[0]], b[groupBy[0]]));
  }

  /**
   * Distinct values for a filter field, e.g. facets('campus'). Handy for dropdowns and counts.
   * @param {string} field One of 'sex', 'dept', 'campus', 'building', 'year', 'dorm'
   * @returns {Array<{value: string, count: number}>}
   */
  facets(field) {
    const m = this.fieldIndex[field];
    if (!m) throw new Error(`Unknown field "${field}". Use one of: ${FILTER_FIELDS.join(', ')}`);
    return [...m.entries()]
      .map(([k, ids]) => ({ value: this.records[ids[0]][field], count: ids.length }))
      .sort((a, b) => b.count - a.count);
  }
}

const DormSDK = HuStdLookupSdk;

module.exports = HuStdLookupSdk;
module.exports.HuStdLookupSdk = HuStdLookupSdk;
module.exports.DormSDK = DormSDK;
module.exports.FILTER_FIELDS = FILTER_FIELDS;
module.exports.default = HuStdLookupSdk;
