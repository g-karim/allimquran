# ALLIM Qur’an Academy — internal implementation blueprint

This blueprint is for implementation after the live LMS schema and permissions have been inspected. It is not a claim that the following records already exist in production.

## Product boundary

- All self-guided digital learning remains free worldwide: reading, listening, hifz planning and review, Qur’anic Arabic, source-bound tafsir, reflection, and private progress.
- Live teacher time, assessed programs, cohort support and related guided services may be paid.
- Ijazah is not generated or granted by software. It may be recorded only after a qualified authorized teacher completes the required teaching, recitation and evaluation.

## Roles

1. Learner
2. Guardian
3. Teacher applicant
4. Verified teacher
5. Academic reviewer
6. Academy manager
7. Ijazah examiner
8. Support

Permissions should follow least privilege. Audio submissions, private reflections, teacher verification documents and learner notes must not be publicly accessible.

## Core records

### Identity and teaching

- **ALLIM Learner Profile** — user, preferred language, timezone, age band, guardian link, level, goals and privacy choices.
- **ALLIM Guardian Link** — learner, guardian, relationship, approved permissions and status.
- **ALLIM Teacher Profile** — user, biography, teaching languages, qualifications, private verification evidence, approval status and availability.
- **ALLIM Teacher Authorization** — verified scope of teaching, riwayah or qira’ah where applicable, approving reviewer, validity and evidence.

### Curriculum and delivery

- **ALLIM Program** — free or guided, title, language, level, outcomes, prerequisites, curriculum version, delivery type and publication state.
- **ALLIM Cohort** — program, teacher, capacity, timezone, schedule, start and end dates, and status.
- **ALLIM Enrollment** — learner, program or cohort, free or guided status, progress, consent and completion state.
- **ALLIM Lesson** — program, sequence, ayah range, learning objectives, resources and release rules.
- **ALLIM Live Session** — cohort, teacher, start and end time, meeting link, attendance and recording consent.

### Learning and feedback

- **ALLIM Assignment** — lesson, task type, due date, rubric and accepted submission formats.
- **ALLIM Submission** — learner, assignment, private audio, text or file, submission state and timestamps.
- **ALLIM Teacher Feedback** — submission, teacher, timestamped ayah or word references, rubric results, public-to-learner feedback and private academic notes.
- **ALLIM Recitation Assessment** — learner, evaluator, surah and ayah range, criteria, result, required corrections and next review.
- **ALLIM Hifz Plan** — learner, new memorization, recent review and long-term review allocations.
- **ALLIM Hifz Review Item** — ayah range, due date, strength, mistake history, source session and next interval.
- **ALLIM Reflection** — private learner record linked to an ayah, action and review date.

### Ijazah governance

- **ALLIM Ijazah Track** — learner, authorized teacher, riwayah or scope, requirements, status and start date.
- **ALLIM Ijazah Milestone** — track, assessed range, evaluator, evidence, outcome and corrections.
- **ALLIM Ijazah Record** — issued only by an authorized human role; holder, teacher, scope, date, evidence and verification code. Issued records should be protected from ordinary editing and retain an audit history.

### Commercial layer

- **ALLIM Teacher Offering** — teacher, program, format, duration, language, capacity and approved fee.
- **ALLIM Booking** — learner, offering, schedule, status and cancellation policy acceptance.
- Reuse the live system’s existing invoices, payments, discounts and scholarship records where possible. Do not duplicate financial records before inspecting the deployed schema.

## Workflows

### Teacher verification

Draft → Submitted → Academic review → Verified / More evidence required / Rejected → Suspended or expired when needed.

### Guided learning

Program draft → Academic review → Published → Enrollment → Active learning → Assessment → Completed / Needs revision.

### Ijazah

Application → Teacher acceptance → Active track → Milestone assessments → Final human evaluation → Issued or further study required.

No automated score can move the final step to “Issued.”

## Portals

- **Learner dashboard** — today’s reading, review queue, courses, live sessions, submissions, teacher feedback and progress.
- **Teacher workspace** — schedule, learners, cohorts, audio review, feedback templates and assessments.
- **Guardian view** — child progress and schedule limited to approved permissions.
- **Academy management** — applications, teacher verification, programs, cohorts, quality review and support.
- **Ijazah verification page** — verification code, holder-approved public fields, teacher and scope; no private evidence.

## Implementation order

1. Inspect the existing LMS, users, roles, course records, payment records and portal routes.
2. Map existing records to this model and create only the missing extensions.
3. Configure roles and permission tests before importing real learner data.
4. Build learner and teacher dashboards with English, Arabic RTL and Russian localization.
5. Test free enrollment, paid teacher booking, audio submission privacy, feedback, timezone handling and ijazah authorization.
6. Pilot with a small verified teacher group before broader enrollment.

## Acceptance checks

- A learner can use self-guided learning without payment.
- A paid boundary appears only when booking teacher-led services or assessed guided programs.
- A teacher cannot access learners outside their assigned cohort or booking.
- Private audio and reflections are inaccessible to other learners and anonymous visitors.
- Arabic layouts are properly mirrored; mixed Arabic, Latin text and numbers remain readable.
- No AI result is represented as a teacher’s authorization or an ijazah.
