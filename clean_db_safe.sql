BEGIN;

CREATE TEMP TABLE users_to_delete AS
SELECT id FROM users 
WHERE email NOT LIKE '%oingu%' 
AND email NOT IN ('admin@example.com', 'sleepy_genius@test.com', 'hardworking_newbie@test.com', 'wrong_location_pro@test.com', 'demo_hr@test.com');

DELETE FROM application_messages WHERE application_id IN (SELECT id FROM applications WHERE candidate_id IN (SELECT id FROM users_to_delete));
DELETE FROM interviews WHERE application_id IN (SELECT id FROM applications WHERE candidate_id IN (SELECT id FROM users_to_delete));
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users_to_delete);
DELETE FROM applications WHERE candidate_id IN (SELECT id FROM users_to_delete) OR job_id IN (SELECT id FROM jobs WHERE recruiter_id IN (SELECT id FROM users_to_delete));
DELETE FROM auth_tokens WHERE user_id IN (SELECT id FROM users_to_delete);
DELETE FROM hidden_jobs WHERE candidate_id IN (SELECT id FROM users_to_delete) OR job_id IN (SELECT id FROM jobs WHERE recruiter_id IN (SELECT id FROM users_to_delete));
DELETE FROM interaction_logs WHERE user_id IN (SELECT id FROM users_to_delete) OR job_id IN (SELECT id FROM jobs WHERE recruiter_id IN (SELECT id FROM users_to_delete));
DELETE FROM recommendations WHERE candidate_id IN (SELECT id FROM users_to_delete) OR job_id IN (SELECT id FROM jobs WHERE recruiter_id IN (SELECT id FROM users_to_delete));
DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users_to_delete);
DELETE FROM events;

DELETE FROM candidate_profiles WHERE user_id IN (SELECT id FROM users_to_delete);
DELETE FROM recruiter_profiles WHERE user_id IN (SELECT id FROM users_to_delete);
DELETE FROM jobs WHERE recruiter_id IN (SELECT id FROM users_to_delete);
DELETE FROM users WHERE id IN (SELECT id FROM users_to_delete);

COMMIT;
