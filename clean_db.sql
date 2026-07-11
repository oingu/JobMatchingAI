DELETE FROM interaction_logs;
DELETE FROM recommendations;
DELETE FROM events;
DELETE FROM application_messages;
DELETE FROM interviews;
DELETE FROM notifications;
DELETE FROM applications;
DELETE FROM auth_tokens;

-- Delete jobs created by users we are about to delete
DELETE FROM jobs WHERE recruiter_id IN (
    SELECT id FROM users 
    WHERE email NOT LIKE '%oingu%' 
    AND email NOT IN ('admin@example.com', 'sleepy_genius@test.com', 'hardworking_newbie@test.com', 'wrong_location_pro@test.com', 'demo_hr@test.com')
);

-- Delete profiles of users we are about to delete
DELETE FROM candidate_profiles WHERE user_id IN (
    SELECT id FROM users 
    WHERE email NOT LIKE '%oingu%' 
    AND email NOT IN ('admin@example.com', 'sleepy_genius@test.com', 'hardworking_newbie@test.com', 'wrong_location_pro@test.com', 'demo_hr@test.com')
);

DELETE FROM recruiter_profiles WHERE user_id IN (
    SELECT id FROM users 
    WHERE email NOT LIKE '%oingu%' 
    AND email NOT IN ('admin@example.com', 'sleepy_genius@test.com', 'hardworking_newbie@test.com', 'wrong_location_pro@test.com', 'demo_hr@test.com')
);

-- Finally delete the users themselves
DELETE FROM users 
WHERE email NOT LIKE '%oingu%' 
AND email NOT IN ('admin@example.com', 'sleepy_genius@test.com', 'hardworking_newbie@test.com', 'wrong_location_pro@test.com', 'demo_hr@test.com');
