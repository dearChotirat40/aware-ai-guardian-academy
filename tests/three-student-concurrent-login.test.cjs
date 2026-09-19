const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table app_settings(id text primary key, data jsonb, updated_at bigint);
    create table students(
      id text primary key,
      data jsonb,
      updated_at bigint,
      rank_points integer,
      user_id uuid
    );
    create function test_mode_enabled() returns boolean language sql as $$select true$$;
    create table student_sessions(
      user_id uuid primary key,
      student_id text references students(id),
      claimed_at timestamptz
    );
    insert into app_settings values
      ('test_mode', '{"enabled":true,"student_count":2}', 0),
      ('test_roster', '{"items":[{"code":"9001","num":"1"},{"code":"9002","num":"2"},{"code":"9003","num":"3"}]}', 0);
  `);

  await db.exec(fs.readFileSync('supabase-repair-three-test-codes.sql', 'utf8'));

  const users = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003'
  ];
  const codes = ['9001', '9002', '9003'];

  for (let i = 0; i < users.length; i += 1) {
    await db.exec(`set request.jwt.claim.sub='${users[i]}'`);
    const result = await db.query('select claim_student($1) as account', [codes[i]]);
    assert.equal(result.rows[0].account.id, `roster_${codes[i]}`);
  }

  const sessions = await db.query(`
    select user_id::text, student_id
    from student_sessions
    order by user_id
  `);
  assert.deepEqual(sessions.rows, [
    { user_id: users[0], student_id: 'roster_9001' },
    { user_id: users[1], student_id: 'roster_9002' },
    { user_id: users[2], student_id: 'roster_9003' }
  ]);

  await db.close();
  console.log('PASS: three distinct students stay signed in at the same time');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
