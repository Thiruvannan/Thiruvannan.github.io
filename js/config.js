// ==========================================================================
// TACTICAL CONFIGURATION & ACADEMIC TELEMETRY
// ==========================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDFM_WnGNOjUNIAC6ck6eGRjAeTDvjdzJQ",
  authDomain: "srm-hub-4dc4b.firebaseapp.com",
  databaseURL: "https://srm-hub-4dc4b-default-rtdb.firebaseio.com",
  projectId: "srm-hub-4dc4b",
  storageBucket: "srm-hub-4dc4b.firebasestorage.app",
  messagingSenderId: "39200598376",
  appId: "1:39200598376:web:3e4bacf3419f92728b0edd",
  measurementId: "G-PJCGLCEP03"
};

export const SECRET_PIN = "5428";

export const subjectIcons = {
  "26CYB1002J": "atom",
  "26BTB1001T": "dna",
  "26MEE1001L": "wrench",
  "26CSE1002J": "terminal",
  "26MAB1001T": "sigma",
  "26LCA1006J": "languages",
  "26GNN1007J": "flame"
};

export const baselineAttendance = {
  "26CYB1002J": { name: "CHEMISTRY FOR CS", attended: 49, conducted: 49 },
  "26BTB1001T": { name: "COMPUTATIONAL BIOLOGY", attended: 17, conducted: 17 },
  "26MEE1001L": { name: "WORKSHOP PRACTICE", attended: 44, conducted: 44 },
  "26CSE1002J": { name: "PROGRAMMING", attended: 45, conducted: 45 },
  "26MAB1001T": { name: "CALCULUS & ALGEBRA", attended: 37, conducted: 37 },
  "26LCA1006J": { name: "KOREAN", attended: 30, conducted: 33 },
  "26GNN1007J": { name: "YOGA", attended: 18, conducted: 18 }
};

export const slots = {
  1: { str: "08:00 - 08:50", start: 480, end: 530 },
  2: { str: "08:50 - 09:40", start: 530, end: 580 },
  3: { str: "09:45 - 10:35", start: 585, end: 635 },
  4: { str: "10:40 - 11:30", start: 640, end: 690 },
  5: { str: "11:35 - 12:25", start: 695, end: 745 },
  6: { str: "12:30 - 13:20", start: 750, end: 800 },
  7: { str: "13:25 - 14:15", start: 805, end: 855 },
  8: { str: "14:20 - 15:10", start: 860, end: 910 },
  9: { str: "15:10 - 16:00", start: 910, end: 960 },
  10: { str: "16:00 - 16:50", start: 960, end: 1010 },
  11: { str: "16:50 - 17:30", start: 1010, end: 1050 }
};

export const timetable = {
  1: { 1: "26CYB1002J", 2: "26CYB1002J", 8: "26LCA1006J", 9: "26LCA1006J" },
  2: { 1: "26CYB1002J", 2: "26CYB1002J", 3: "26LCA1006J", 4: "26BTB1001T", 7: "26CSE1002J", 8: "26CSE1002J" },
  3: { 1: "26MEE1001L", 2: "26MEE1001L", 3: "26MEE1001L", 4: "26MEE1001L", 9: "26MAB1001T" },
  4: { 1: "26MAB1001T", 2: "26MAB1001T", 3: "26CYB1002J", 4: "26CSE1002J", 7: "26GNN1007J", 8: "26GNN1007J", 9: "26GNN1007J" },
  5: { 6: "26CSE1002J", 7: "26CSE1002J", 9: "26LCA1006J", 10: "26MAB1001T" }
};

export const academicPlanner = {
  "2026-11-02": 3, "2026-11-03": 4, "2026-11-04": 5, "2026-11-05": 1, "2026-11-06": 2,
  "2026-11-10": 4, "2026-11-11": 5, "2026-11-12": 1, "2026-11-13": 2, "2026-11-16": 3,
  "2026-11-17": 4, "2026-11-18": 5, "2026-11-19": 1, "2026-11-20": 2, "2026-11-23": 3,
  "2026-11-24": 4, "2026-11-25": 5, "2026-11-26": 1, "2026-11-27": 2, "2026-11-30": 3,
  "2026-12-01": 4, "2026-12-02": 5, "2026-12-03": 1, "2026-12-04": 2, "2026-12-07": 3
};
