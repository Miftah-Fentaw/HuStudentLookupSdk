export interface StudentRecord {
  id: string;
  name: string;
  sex: 'M' | 'F' | string;
  dept: string;
  campus: 'Harar' | 'Hit' | 'Main' | 'VET' | string;
  building: string;
  dorm: string;
  year: string;
  dormmates?: string[];
  [key: string]: any;
}

export type FilterField = 'sex' | 'dept' | 'campus' | 'building' | 'year' | 'dorm';
export type SortField = 'name' | 'id' | FilterField;

export interface SearchQuery {
  name?: string;
  /** Opt-in typo-tolerant name matching. Default search stays exact prefix. */
  fuzzy?: boolean;
  /** Max edit distance when fuzzy is true (1 or 2). Default: 1 */
  maxEdits?: number;
  sex?: string | string[];
  dept?: string | string[];
  campus?: string | string[];
  building?: string | string[];
  year?: string | string[];
  dorm?: string | string[];
  sortBy?: SortField | string;
  sortDir?: 'asc' | 'desc' | string;
  limit?: number;
  offset?: number;
  /** 1-based page; when set with pageSize/limit, overrides offset */
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface SearchResult {
  total: number;
  results: StudentRecord[];
}

export interface FacetResult {
  value: string;
  count: number;
}

export interface ValidateIdResult {
  ok: boolean;
  input: string;
  normalized: string;
  reason: 'empty' | 'invalid_format' | 'not_found' | null;
  student: StudentRecord | null;
}

export interface SuggestOptions {
  limit?: number;
  fuzzy?: boolean;
  maxEdits?: number;
  /** 'name' (default) returns students; a filter field returns facet values */
  field?: 'name' | FilterField | string;
}

export interface StatsQuery {
  groupBy: FilterField | FilterField[] | string | string[];
  name?: string;
  fuzzy?: boolean;
  maxEdits?: number;
  sex?: string | string[];
  dept?: string | string[];
  campus?: string | string[];
  building?: string | string[];
  year?: string | string[];
  dorm?: string | string[];
  [key: string]: any;
}

export type StatsResult = Record<string, string | number> & { count: number };

export interface HuStdLookupData {
  students: Record<string, StudentRecord> | StudentRecord[];
  campuses?: string[];
  departments?: string[];
}

export class HuStdLookupSdk {
  records: StudentRecord[];
  size: number;
  campuses: string[];
  departments: string[];

  constructor(data?: HuStdLookupData | StudentRecord[]);

  /**
   * Load SDK with predefined data from data.json.
   */
  static load(): HuStdLookupSdk;

  /**
   * O(1) lookup by student ID. Case/space-insensitive; leading 'UGPR' prefix is stripped.
   */
  getById(id: string): StudentRecord | null;

  /**
   * Batch lookup. One entry per input id (record or null), same order.
   */
  getByIds(ids: string[]): Array<StudentRecord | null>;

  /**
   * Validate and normalize a student ID for forms and bots.
   */
  validateId(id: string): ValidateIdResult;

  /**
   * Return array of student records for the roommates of the given student ID, excluding self.
   */
  getDormmates(id: string): StudentRecord[];

  /**
   * Fast prefix and multi-field filtered search.
   * Optional fuzzy, sortBy/sortDir, and page/pageSize do not change default behavior.
   */
  search(query?: SearchQuery): SearchResult;

  /**
   * Autocomplete: students by name prefix, or facet values when field is a filter field.
   */
  suggest(query: string, opts?: SuggestOptions): StudentRecord[] | FacetResult[];

  /**
   * Aggregate counts by one or more fields. Optional filters match search().
   */
  stats(query: StatsQuery): StatsResult[];

  /**
   * Distinct values and counts for a filter field. Useful for dropdowns and analytics.
   */
  facets(field: FilterField | string): FacetResult[];
}

export const FILTER_FIELDS: readonly ['sex', 'dept', 'campus', 'building', 'year', 'dorm'];
export const DormSDK: typeof HuStdLookupSdk;

export default HuStdLookupSdk;
