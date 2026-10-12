# HuStdLookupSdk

![HuStdLookupSdk header](src/HuSdt.png)
> A simple and fast tool to find student and dorm room information for Haramaya University.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/types-included-blue.svg)]()

`HuStdLookupSdk` is an easy-to-use JavaScript library for student projects. It helps you search and look up information for more than 12,000 Haramaya University students and their dorm rooms. 

It comes with all student data built-in, works completely offline without any internet connection, and requires zero extra tools to install.

---

## What It Can Do

- Find by ID: Look up any student quickly with their ID. It does not care about extra spaces, capital letters, or if you add "UGPR" at the front (for example, `"UGPR0276/15"` and `"0276/15"` both work).
- Batch Lookup: Resolve many IDs at once with `getByIds`.
- Validate IDs: Check and normalize an ID for forms with `validateId`.
- Search by Name: Type one or more parts of a name to find students (for example, typing `"dagim alemu"` finds `"Dagim Alemu Alolo"`).
- Fuzzy Name Search (opt-in): Allow small typos with `fuzzy: true` without changing default search speed.
- Autocomplete: Suggest students or campus/department values as the user types with `suggest`.
- Filter by Category: Find students by gender, department, campus, building, dorm room, or year.
- Search Multiple Things at Once: Search across multiple campuses or departments by passing a list (for example, `['Main', 'Hit']`).
- Sort and Page: Sort by field and use `page` / `pageSize` for tables.
- Stats for Charts: Group and count students with `stats({ groupBy })`.
- Find Roommates: Get full details for all students who share the same dorm room.
- Count Options for Dropdowns: Get a list of all campus or department names and how many students are in each, perfect for dropdown menus.
- Split Results into Pages: Show results in small pages so your website stays fast.
- Zero Setup: Works right out of the box with standard Node.js.
- Works with Older Code: Also supports the previous name `DormSDK`.

---

## Project Structure

```text
.
├── package.json           # Project settings and scripts
├── readme.md              # Documentation and guide
├── sdk.test.js            # Automated tests
└── src/
    ├── HuStdLookupSdk.js  # Main SDK code
    ├── data.json          # Built-in student dataset
    ├── index.d.ts         # Type hints for code editors
    └── index.js           # Package entry point
```

---

## Project Ideas and Use Cases

Because this tool works offline with no internet needed and answers searches instantly, students can use it to build many useful campus tools:

### 1. Student ID Check and Auto-Fill (Forms and Registration)
When students sign up for a campus club (like GDSC or Red Cross), a hackathon, or a campus event, you can check their ID and fill in their details automatically:
- Check that the entered ID belongs to a real student.
- Automatically fill in their full name, department, campus, and year so they do not have to type it by hand.
- Stop fake sign-ups and typing mistakes.

Example using an Express.js backend server:

```javascript
app.post('/api/register', (req, res) => {
  const { studentId, email } = req.body;

  // 1. Check if the student ID exists in the university data
  const student = sdk.getById(studentId);
  if (!student) {
    return res.status(400).json({ error: 'Please enter a valid Haramaya University student ID.' });
  }

  // 2. Automatically use their real official information
  const newMember = {
    id: student.id,
    fullName: student.name,
    department: student.dept,
    campus: student.campus,
    year: student.year,
    email: email
  };

  // 3. Save newMember to your database...
  res.json({ success: true, member: newMember });
});
```

### 2. Telegram Bot for Dorm and Roommate Lookups
Build a Telegram bot where students can send a message to find their room:
- Send `/dorm 0276/15` to see their building name, floor, and room number.
- Send `/roommates 0276/15` to see the names of students sharing the room before arriving on campus.
- Search for a classmate by name directly inside Telegram chat.

### 3. Roommate Connect Website or Mobile App
Create a simple web or mobile app (using React, Flutter, or HTML):
- Students log in or enter their ID to see their assigned room.
- Show students who their roommates are so they can connect, introduce themselves, and plan what items to bring before campus opens.

### 4. Campus Charts and Statistics
Build a dashboard with charts showing university information:
- How many students are on each campus (Main, HiT, Harar, VET).
- Number of male and female students in each department.
- How full each dorm building is.

### 5. Lost and Found Helper
If someone finds a lost student ID card or notebook on campus:
- Enter the ID on a simple campus search page.
- Find the student's name, dorm building, and room number so you can return the lost item directly to their room.

### 6. Offline Check-In for Campus Events and Elections
Because all data is saved inside your computer and does not need internet:
- Build a check-in scanner for library entry or student union elections that still works even if the campus Wi-Fi stops working.

---

## Installation

Install the package into your project:

```bash
npm install hu-std-lookup-sdk
```

---

## Quick Start

### 1. Import the Library

In CommonJS (standard Node.js):
```javascript
const HuStdLookupSdk = require('hu-std-lookup-sdk');
```

In ES Modules or TypeScript:
```javascript
import HuStdLookupSdk from 'hu-std-lookup-sdk';
```

### 2. Load the Data

Load the built-in student records (takes no settings):

```javascript
const sdk = HuStdLookupSdk.load();
```

---

## Step-by-Step Code Examples

### 1. Look Up a Student by ID

#### Example A: Dagim Alemu (Software Engineering, Main Campus)
```javascript
const dagim = sdk.getById('0276/15');
console.log(dagim);
/*
Output:
{
  id: '0276/15',
  name: 'Dagim Alemu Alolo',
  sex: 'M',
  dept: 'SWE',
  campus: 'Main',
  building: 'SAT 4A',
  dorm: '120',
  year: '5th',
  dormmates: ['0272/15', '0297/15', '0301/15']
}
*/

// Extra spaces and lowercase work too:
sdk.getById(' 0276/15 ');
// You can also include the "UGPR" letters:
sdk.getById('UGPR0276/15');
```

#### Example B: Elbetel Taye (Mechanical Engineering, HiT Campus)
```javascript
const elbetel = sdk.getById('1228/18');
console.log(elbetel);
/*
Output:
{
  id: '1228/18',
  name: 'Elbetel Taye Ladankilet',
  sex: 'F',
  dept: 'Meng',
  campus: 'Hit',
  building: 'Block LA',
  dorm: '44',
  year: '2nd',
  dormmates: ['0844/18', '1315/18', '1788/18', '1836/18', '1979/18']
}
*/
```

---

### 2. Get Full Details for Roommates

The `getDormmates()` method gives you full student details for everyone sharing the same room (without including yourself):

```javascript
// Get roommates of Dagim Alemu in Dorm 120 (SAT 4A building):
const dagimRoommates = sdk.getDormmates('0276/15');
dagimRoommates.forEach((mate) => {
  console.log(`${mate.name} - Department: ${mate.dept} (Dorm ${mate.dorm})`);
});
/*
Output:
Chuol Nyuon Dak - Department: SWE (Dorm 120)
Dawit Mengesha Beriso - Department: SWE (Dorm 120)
Debela Kebede Bekele - Department: SWE (Dorm 120)
*/

// Get roommates of Elbetel Taye in Dorm 44 (Block LA building):
const elbetelRoommates = sdk.getDormmates('1228/18');
elbetelRoommates.forEach((mate) => {
  console.log(`${mate.name} - Department: ${mate.dept} (Dorm ${mate.dorm})`);
});
/*
Output:
Beimnet Zelalem Desta - Department: Meng (Dorm 44)
Eyerus Tesfaye Garedew - Department: Meng (Dorm 44)
Hlina Solomon Maru - Department: Meng (Dorm 44)
Iftu Berhanu Dabali - Department: Meng (Dorm 44)
Kemer Emam Essa - Department: Meng (Dorm 44)
*/
```

---

### 3. Search for Students by Name

You only need to type parts of a name:

```javascript
// Search for Dagim Alemu in Software Engineering:
const sweResults = sdk.search({
  name: 'dagim alemu',
  dept: 'SWE',
  campus: 'Main'
});
console.log(`Found ${sweResults.total} student(s):`);
sweResults.results.forEach((s) => console.log(`- ${s.name} (${s.id})`));
// Output: - Dagim Alemu Alolo (0276/15)

// Search for Elbetel in Mechanical Engineering (Meng):
const mengResults = sdk.search({
  name: 'elbetel',
  dept: 'Meng',
  campus: 'Hit'
});
console.log(`Found ${mengResults.total} student(s):`);
mengResults.results.forEach((s) => console.log(`- ${s.name} (${s.id})`));
// Output: - Elbetel Taye Ladankilet (1228/18)
```

---

### 4. Filter by Category

Combine different options to narrow down your search:

```javascript
// Find all 5th-year Software Engineering students on Main campus:
const fifthYearSwe = sdk.search({
  dept: 'SWE',
  campus: 'Main',
  year: '5th'
});
console.log(`Total students: ${fifthYearSwe.total}`);

// Find 2nd-year female Mechanical Engineering students:
const femaleMechStudents = sdk.search({
  dept: 'Meng',
  sex: 'F',
  year: '2nd'
});
console.log(`Total students: ${femaleMechStudents.total}`);
```

---

### 5. Search Multiple Values and Show in Pages

Pass an array of names to search across multiple choices at once, and set a page size:

```javascript
const engineeringStudents = sdk.search({
  dept: ['SWE', 'Meng'],
  campus: ['Main', 'Hit'],
  limit: 10,  // Show only 10 students
  offset: 0   // Start from the first student
});

console.log(`Total matches in university: ${engineeringStudents.total}`);
console.log(`Students on this page: ${engineeringStudents.results.length}`);
```

---

### 6. Get Counts for Dropdown Menus

Use `facets()` to get all unique values and the number of students for each. This makes creating dropdowns very easy:

```javascript
// Get all campus names and student counts:
const campuses = sdk.facets('campus');
console.log(campuses);
/*
Output:
[
  { value: 'Main', count: 6800 },
  { value: 'Hit', count: 2650 },
  { value: 'Harar', count: 2575 },
  { value: 'VET', count: 186 }
]
*/

// Get all department names:
const departments = sdk.facets('dept');
console.log(`Total departments available: ${departments.length}`);
```

---

### 7. Batch Lookup, Validate, Suggest, Fuzzy Search, and Stats

```javascript
// Many IDs at once (same order; missing IDs are null):
sdk.getByIds(['0276/15', 'UGPR1228/18', 'nope']);

// Forms / bots:
sdk.validateId('  UGPR0276/15 ');
// { ok: true, normalized: '0276/15', reason: null, student: { ... } }

// Autocomplete for a search box:
sdk.suggest('dagim alemu', { limit: 8 });
sdk.suggest('ma', { field: 'campus', limit: 5 });

// Default name search stays exact prefix. Fuzzy is opt-in only:
sdk.search({ name: 'dagm alemu' });                 // no match
sdk.search({ name: 'dagm alemu', fuzzy: true });    // finds Dagim Alemu Alolo

// Sort + page helpers (default name A-Z is unchanged when sortBy is omitted):
sdk.search({ campus: 'Hit', sortBy: 'dept', sortDir: 'asc', page: 2, pageSize: 20 });

// Charts / dashboards:
sdk.stats({ groupBy: 'campus' });
sdk.stats({ groupBy: ['campus', 'sex'], campus: 'Hit' });
```

---

## Reference Guide

### Functions and Methods

- `HuStdLookupSdk.load()`
  Loads the built-in student dataset. Takes no settings and returns an SDK instance.

- `sdk.getById(id)`
  Finds a single student by their ID number. Returns the student object, or `null` if not found.

- `sdk.getByIds(ids)`
  Batch lookup. Returns one entry per input id (student object or `null`), in the same order.

- `sdk.validateId(id)`
  Normalizes and checks an ID. Returns `{ ok, input, normalized, reason, student }`.
  `reason` is `'empty'`, `'invalid_format'`, `'not_found'`, or `null` when valid.

- `sdk.getDormmates(id)`
  Finds all students who share the same dorm room with the given student ID. Returns a list of student objects (excluding the student themselves).

- `sdk.search(options)`
  Searches students by name or filters. You can pass:
  - `name`: Text to match in the student name (prefix by default).
  - `fuzzy`: Opt-in typo tolerance for `name` (default `false`; existing callers stay fast).
  - `maxEdits`: Max edit distance when `fuzzy` is true (default `1`, max `2`).
  - `sex`: `'M'` or `'F'`.
  - `dept`: Department code (like `'SWE'`, `'Meng'`).
  - `campus`: Campus name (like `'Main'`, `'Hit'`, `'Harar'`, `'VET'`).
  - `building`: Dorm building name (like `'SAT 4A'`, `'Block LA'`).
  - `dorm`: Dorm room number (like `'120'`, `'44'`).
  - `year`: Academic year (like `'1st'`, `'2nd'`, `'5th'`).
  - `sortBy`: Optional sort field (`name`, `id`, `sex`, `dept`, `campus`, `building`, `year`, `dorm`).
  - `sortDir`: `'asc'` (default) or `'desc'`.
  - `limit`: Maximum number of results to return (default is 50).
  - `offset`: Number of results to skip for pages (default is 0).
  - `page` / `pageSize`: Optional 1-based paging helpers (set `offset` / `limit` for you).

- `sdk.suggest(query, options?)`
  Autocomplete helper. By default returns matching students by name prefix.
  Pass `{ field: 'campus' }` (or another filter field) to suggest facet values.
  Supports `{ limit, fuzzy, maxEdits }`.

- `sdk.stats(options)`
  Groups and counts students. Requires `groupBy` (string or array of filter fields).
  Accepts the same filters as `search` (including optional `name` / `fuzzy`).

- `sdk.facets(fieldName)`
  Returns a list of all unique values and counts for that field (for example, `'campus'` or `'dept'`).

### Properties

- `sdk.records`: Array of all 12,000+ students sorted from A to Z by name.
- `sdk.size`: Total number of students.
- `sdk.campuses`: List of all university campuses.
- `sdk.departments`: List of all university departments.

---

## Student Record Fields

Each student has the following information:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Student ID number (for example, `'0276/15'`, `'1228/18'`) |
| `name` | `string` | Full name of the student |
| `sex` | `string` | Gender (`'M'` for male, `'F'` for female) |
| `dept` | `string` | Department code |
| `campus` | `string` | Campus name (`'Main'`, `'Hit'`, `'Harar'`, `'VET'`) |
| `building` | `string` | Dorm building or block |
| `dorm` | `string` | Dorm room number |
| `year` | `string` | Study year |
| `dormmates` | `string[]` | List of student IDs for roommates in the same room |

---

## Testing

To run the automated tests:

```bash
npm test
```

---

## Contributing

Contributions are always welcome. See the [contribution guide](CONTRIBUTING.md) for setup, tests, and pull requests.

---

## License

This project is licensed under the [MIT License](LICENSE).
