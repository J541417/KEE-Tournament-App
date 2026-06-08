Golf League Starter App

Vercel environment variables needed:

GOOGLE_SHEET_ID=1pfHBTT_RehGQN96eQa8Dv_5lpRpJqz6J7z8fnckAOSs
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
ADMIN_PASSWORD=

Google Sheet tabs expected:

Players
Courses
data

The data tab header row should be:

record_type | tournament_id | round_id | round_number | team_id | team_number | player_id | player_name | player_rating | course_name | round_date | scoring_mode | hole_number | score | token | status | updated_at | notes

First test rows needed in data:

round | T1 | R1 | 1 | | | | | | Michigan Meadows | 2026-06-10 | team | | | | active | 2026-06-08T12:00:00 | Test active round
round_player | T1 | R1 | 1 | T1 | 1 | 5865551212 | Jason Meesseman | 6.39 | | | | | | | active | 2026-06-08T12:01:00 | Test player
