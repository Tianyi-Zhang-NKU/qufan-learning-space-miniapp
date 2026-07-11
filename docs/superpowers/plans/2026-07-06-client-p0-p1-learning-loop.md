# Client P0 P1 Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the client-requested learning loop: classroom quiz, lesson summary, inline feedback, pass confirmation, teacher to-dos, wrong-question workbook export, and honor records.

**Architecture:** Keep the miniapp mock-first architecture. Add durable mock data structures in `services/mock-db.js`, expose them through cohesive APIs in `services/api.js`, then wire teacher and parent pages to those APIs. Use `scripts/smoke-test.js` as the executable acceptance suite for P0/P1.

**Tech Stack:** WeChat miniapp JavaScript/WXML/WXSS, local mock API, Node smoke tests.

---

### Task 1: Acceptance Tests

**Files:**
- Modify: `scripts/smoke-test.js`

- [ ] Add checks that public UI copy uses `课堂小测` and `本讲总结` as the primary labels, with legacy `课前测/课后测` only allowed as sublabels inside the classroom quiz choice.
- [ ] Add API checks for feedback document upload, single-record multi-edit behavior, pass confirmation, teacher to-do removal after confirmation, wrong-question creation/selection/export, and honor certificate generation.
- [ ] Run `node scripts/smoke-test.js` and verify it fails on missing P0/P1 behavior.

### Task 2: Feedback Editing And Documents

**Files:**
- Modify: `services/api.js`
- Modify: `services/mock-db.js`
- Modify: `pages/teacher/feedback-detail/feedback-detail.js`
- Modify: `pages/teacher/feedback-detail/feedback-detail.wxml`
- Modify: `pages/parent/summary/summary.js`
- Modify: `pages/parent/summary/summary.wxml`
- Modify: `pages/parent/exercises/exercises.js`
- Modify: `pages/parent/exercises/exercises.wxml`

- [ ] Implement `uploadFeedbackFile`.
- [ ] Make `createLessonFeedback` upsert by `studentId + courseSessionId + feedbackType` so repeated edits update one record and preserve edit history.
- [ ] Show attached documents inline in parent summary and feedback detail.
- [ ] Run `node scripts/smoke-test.js`.

### Task 3: Teacher To-Dos And Pass Confirmation

**Files:**
- Modify: `services/api.js`
- Modify: `pages/teacher/home/home.js`
- Modify: `pages/teacher/home/home.wxml`
- Modify: `pages/teacher/feedback-detail/feedback-detail.js`
- Modify: `pages/teacher/feedback-detail/feedback-detail.wxml`

- [ ] Add `getTeacherTodos` grouped by course/session with pending pass confirmations.
- [ ] Add `confirmStudentPass` and use it from feedback detail.
- [ ] Put a top-level teacher to-do section on teacher home and a fixed confirmation action in feedback detail.
- [ ] Run `node scripts/smoke-test.js`.

### Task 4: Wrong-Question Workbook

**Files:**
- Modify: `services/mock-db.js`
- Modify: `services/api.js`
- Modify: `pages/teacher/test-upload/test-upload.js`
- Modify: `pages/teacher/test-upload/test-upload.wxml`
- Modify: `pages/parent/exercises/exercises.js`
- Modify: `pages/parent/exercises/exercises.wxml`

- [ ] Add question items under assignments, including file metadata per question.
- [ ] Add APIs to create lesson questions, mark a student's wrong question IDs, summarize wrong questions by student/course/session, and export a single printable PDF/Word placeholder.
- [ ] Add teacher controls to upload/create question slots and mark wrong questions from the student feedback flow.
- [ ] Add parent workbook summary and export action.
- [ ] Run `node scripts/smoke-test.js`.

### Task 5: Honors And Visual Polish

**Files:**
- Modify: `services/mock-db.js`
- Modify: `services/api.js`
- Modify: `pages/parent/home/home.js`
- Modify: `pages/parent/home/home.wxml`
- Modify: `pages/parent/summary/summary.js`
- Modify: `pages/parent/summary/summary.wxml`
- Modify: `pages/teacher/feedback-students/feedback-students.wxml`
- Modify: `pages/teacher/feedback-students/feedback-students.wxss`

- [ ] Add student honor records and certificate payloads when course pass progress reaches the configured threshold.
- [ ] Surface honor history on parent home and summary pages.
- [ ] Ensure teacher student lists render as compact avatar grids for large classes.
- [ ] Run `node scripts/check-js.js` and `node scripts/smoke-test.js`.

### Task 6: Final Audit

**Files:**
- Modify: code as needed based on audit

- [ ] Search for remaining legacy copy and remove main-flow leftovers.
- [ ] Run `node scripts/check-js.js`.
- [ ] Run `node scripts/smoke-test.js`.
- [ ] Review `git diff --stat` and commit a validated implementation batch.
