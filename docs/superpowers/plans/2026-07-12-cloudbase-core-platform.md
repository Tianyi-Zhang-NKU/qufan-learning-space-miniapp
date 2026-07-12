# CloudBase Core Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the core learning-platform domain layer: pass statistics, focus students, scoped administrator authorization, research materials, and CloudBase-ready integration contracts while preserving a runnable Mock Demo.

**Architecture:** Keep pages calling `services/api.js`; move all shared calculations and authorization into cohesive domain helpers within that service. The Mock adapter is the executable specification. CloudBase and HTTP adapters must expose the same method names so the miniapp and the future research web app do not depend on a data source directly.

**Tech Stack:** WeChat mini-program JavaScript/WXML/WXSS, Node.js smoke tests, Mock API now; CloudBase database, cloud functions, cloud storage, and static hosting adapter contracts next.

---

### Task 1: Pass Statistics And Focus Student Domain

**Files:**
- Modify: `services/mock-db.js`
- Modify: `services/api.js`
- Modify: `scripts/smoke-test.js`

- [ ] Add a failing smoke case that confirms a course/session/grade/subject/teacher pass rate uses confirmed passes divided by finished-session student confirmations, and excludes scheduled sessions.
- [ ] Add a failing smoke case that confirms a student with two consecutive missed pass confirmations is `needsAttention`, a student with at least three sessions and 90% pass rate is `excellent`, and admin notes persist by student ID.
- [ ] Add `attentionRules`, `studentAttentionNotes`, `getPassStatistics(filter)`, `getFocusStudents(filter)`, and `saveStudentAttentionNote(payload)` to the mock domain. Return `scope`, `completedSessions`, `confirmedPasses`, `eligibleStudentSessions`, `passRate`, and per-dimension aggregates.
- [ ] Guard both focus APIs with admin scope checks and write audit entries for note updates.
- [ ] Run `node scripts/smoke-test.js` and commit with `feat: add pass statistics domain`.

### Task 2: Multi-Role And Scoped Administrator Authorization

**Files:**
- Modify: `services/mock-db.js`
- Modify: `services/api.js`
- Modify: `utils/page-guard.js`
- Modify: `pages/login/login.js`
- Modify: `scripts/smoke-test.js`

- [ ] Add a failing smoke case for one phone with two roles, role selection, full-access super admin, and a scoped admin who cannot read a non-matching grade or subject.
- [ ] Replace the single-role assumption in `phoneAccounts` with durable `users`, `userRoles`, and `adminGrants` while keeping compatibility records for existing demo phone logins.
- [ ] Add `getAvailableRoles()`, `selectActiveRole(payload)`, `getAdminGrants()`, and `saveAdminGrant(payload)`. A grant must contain a phone, role, grade scopes, subject scopes, enabled flag, and audit fields.
- [ ] Introduce `canAdminAccessScope(session, grade, subject)` and apply it to every administrator read endpoint that returns courses, students, statistics, focus students, grants, or materials.
- [ ] Preserve current user-facing login behavior for a phone with one role; expose a role-selection state only when multiple roles are available.
- [ ] Run `node scripts/check-js.js` and `node scripts/smoke-test.js`, then commit with `feat: add scoped multi-role authorization`.

### Task 3: Administrator Analytics API And Read-Only Boundary

**Files:**
- Modify: `services/api.js`
- Modify: `server/index.js`
- Modify: `services/config.js`
- Modify: `scripts/smoke-test.js`
- Create: `docs/integrations/enrollment-readonly-sync-contract.md`
- Create: `docs/integrations/classin-entry-contract.md`

- [ ] Add failing smoke cases for `getAdminDashboard()`, `getAdminFocusStudents()`, and `saveStudentAttentionNote()` under full and scoped admin sessions.
- [ ] Implement `getAdminDashboard()` by composing Task 1 statistics and focus records. Its response must contain `gradeStatistics`, `subjectStatistics`, `teacherStatistics`, `focusStudents`, and `scope`.
- [ ] Mark `syncEnrollmentChange`, create/update/delete course, student, teacher, classroom, and session mutations as demo-only. The production adapter must reject these operations with a read-only enrollment error.
- [ ] Add HTTP routes for the new read endpoints and note mutation; retain no HTTP route for enrollment mutations.
- [ ] Document the exact inbound enrollment event schema, idempotency key, read-only ownership, ClassIn course/teacher/session identity, signed-entry response, and error codes.
- [ ] Run health-route smoke checks plus existing scripts, then commit with `feat: add admin analytics api contract`.

### Task 4: Administrator Dashboard And Grant Management UI

**Files:**
- Modify: `pages/admin/home/home.js`
- Modify: `pages/admin/home/home.wxml`
- Modify: `pages/admin/home/home.wxss`
- Modify: `pages/admin/manage/manage.js`
- Modify: `pages/admin/manage/manage.wxml`
- Modify: `pages/admin/manage/manage.wxss`
- Modify: `app.json`
- Modify: `scripts/smoke-test.js`

- [ ] Add static smoke assertions that the admin home contains grade, subject, teacher, and focus-student sections, and no longer exposes classroom collection, whole-school timetable, or direct enrollment mutation actions.
- [ ] Replace the admin home landing view with compact grade pass-rate rows, expandable subject breakdowns, teacher pass-rate rows, and focus-student cards with note input and saved state.
- [ ] Limit grant management to super admins. Use a phone input plus grade/subject multi-select controls; scoped admins must never see out-of-scope values in the UI.
- [ ] Remove the old manage and schedule-board navigation from the primary admin experience, and leave route-level access only for migration safety.
- [ ] Verify 375px layout, long names, zero courses, zero completed sessions, and a scoped admin with no matching records.
- [ ] Commit with `feat: replace admin management with pass dashboard`.

### Task 5: Research Material Domain And Teacher-Flow Boundary

**Files:**
- Modify: `services/mock-db.js`
- Modify: `services/api.js`
- Modify: `pages/teacher/home/home.js`
- Modify: `pages/teacher/home/home.wxml`
- Modify: `pages/teacher/courses/courses.js`
- Modify: `pages/teacher/courses/courses.wxml`
- Modify: `pages/teacher/feedback-detail/feedback-detail.js`
- Modify: `pages/teacher/feedback-detail/feedback-detail.wxml`
- Modify: `scripts/smoke-test.js`

- [ ] Add failing smoke cases proving that one published material package can bind to two parallel courses, that a reading group remains a selectable whole unit, and that an old course binding remains on the previous package version after a new draft is published.
- [ ] Add `materialPackages`, `materialUnits`, `materialPublishScopes`, and `courseMaterialBindings` data collections. Require a version number, publishing state, grade, subject, and creator on every package.
- [ ] Add `getTeacherPublishedMaterial(courseSessionId)`, `getResearchMaterials(filter)`, `saveMaterialPackage(payload)`, `publishMaterialPackage(payload)`, and `bindMaterialPackage(payload)`. Only research/admin identities may mutate packages.
- [ ] Make teacher wrong-question selection read the published binding rather than per-teacher uploads. Keep existing question data readable for old records, but hide `pages/teacher/test-upload` from main teacher navigation.
- [ ] Remove course rename, teacher live, and standalone question-upload actions from teacher home/course pages. Keep feedback types to `pre` and `post`; retain pass confirmation as a dedicated action that stores the existing `general` record internally.
- [ ] Run smoke tests for backward-compatible historical wrong selections and commit with `feat: add research material packages`.

### Task 6: Teacher And Student P0 Experience

**Files:**
- Modify: `pages/teacher/home/home.js`
- Modify: `pages/teacher/home/home.wxml`
- Modify: `pages/teacher/home/home.wxss`
- Modify: `pages/teacher/courses/courses.wxml`
- Modify: `pages/teacher/feedback-detail/feedback-detail.js`
- Modify: `pages/teacher/feedback-detail/feedback-detail.wxml`
- Modify: `pages/parent/home/home.js`
- Modify: `pages/parent/home/home.wxml`
- Modify: `pages/parent/home/home.wxss`
- Modify: `pages/parent/summary/summary.wxml`
- Modify: `scripts/smoke-test.js`

- [ ] Add static smoke assertions for a teacher todo badge before today’s courses, no `general` feedback tab, visible class pass rate, visible next-session information, no expanded schedule-line list, and a horizontal-session affordance.
- [ ] Render pending-pass count as a stable badge and place teacher todos at the first actionable location. Each todo deep-links to the matching student and lesson confirmation flow.
- [ ] Add lesson and course pass summaries to teacher rows. Preserve compact student grids for large classes.
- [ ] Render student course cards with next scheduled session as the primary time datum; move schedule details behind the course/lesson view and add a visual right-edge hint to horizontal lesson tabs.
- [ ] Keep the `post` filtering correction in the lesson-summary page and verify media, empty state, long text, and honor information still render without overflow.
- [ ] Commit with `feat: streamline student and teacher learning flow`.

### Task 7: CloudBase And Research Web Application Skeleton

**Files:**
- Create: `cloudfunctions/shared-domain/index.js`
- Create: `cloudfunctions/admin-dashboard/index.js`
- Create: `cloudfunctions/research-materials/index.js`
- Create: `cloudfunctions/enrollment-sync/index.js`
- Create: `research-admin/package.json`
- Create: `research-admin/vite.config.js`
- Create: `research-admin/src/main.jsx`
- Create: `research-admin/src/App.jsx`
- Create: `research-admin/src/api.js`
- Create: `research-admin/src/pages/MaterialPackagesPage.jsx`
- Create: `research-admin/src/pages/MaterialEditorPage.jsx`
- Create: `research-admin/src/styles.css`
- Create: `cloudbaserc.json`
- Modify: `README.md`

- [ ] Add CloudBase function skeletons that validate the active role/scope before calling the same domain method contract. Do not include environment IDs, secrets, or production credentials.
- [ ] Scaffold the Vite research admin with a package list, filter controls, draft/issued status, material-unit editing, and publish-scope selection. It must use a single `src/api.js` adapter so Mock and CloudBase modes have the same client calls.
- [ ] Add a build script and a static rendering check for the research admin. Document local run, CloudBase deployment prerequisites, and the absence of real external credentials.
- [ ] Verify that the Web UI uses research/admin scope from the API response rather than trusting client-side filters.
- [ ] Commit with `feat: scaffold cloudbase research admin`.

### Task 8: Completion Audit And Visual Verification

**Files:**
- Modify: `docs/qufan-visual-acceptance.md`
- Modify: `docs/client-gap-audit-2026-07-12-video.md`
- Modify: `README.md`
- Modify: `scripts/smoke-test.js`

- [ ] Run `node scripts/check-js.js`, `node scripts/smoke-test.js`, research-admin build, and the local server health check.
- [ ] Use WeChat Developer Tools or available browser automation to inspect each changed role at 375px and a desktop research-admin viewport; record screenshots and resolve overflow, hidden controls, zero-state, and permission-denied behavior.
- [ ] Search for stale teacher question-upload, course-rename, classroom-collection, enrollment-write, and general-feedback-tab UI copy. Keep compatibility APIs only when not user-visible.
- [ ] Update the client gap audit with verified completion evidence, remaining external blockers, and the exact API documents sent to the client technical team.
- [ ] Commit with `chore: verify cloudbase core platform`.
