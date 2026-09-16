// Run with NODE_PATH pointing to a directory containing @electric-sql/pglite.
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.user',true),'')::uuid $$;
    create table students(id text primary key,data jsonb not null);
    create function owns_student(p_id text) returns boolean language sql as $$
      select p_id = current_setting('test.student',true) $$;`);
  await db.exec(readFileSync('supabase-cabinet-wallet.sql','utf8'));
  const setAccount = async (id) => {
    await db.query("select set_config('test.user',$1,false),set_config('test.student',$2,false)", [randomUUID(),id]);
  };
  const call = async (id, request = null) => (await db.query('select cabinet_account($1,$2) as wallet',[id,request])).rows[0].wallet;
  await db.query('insert into students values ($1,$2),($3,$4)',[
    'alice',JSON.stringify({badgeIds:['badge1','badge1','badge2','bogus'],lp:[{clawPrizes:['น้องชวนคิด สีฟ้า']}]}),
    'bob',JSON.stringify({badgeIds:['badge1'],lp:[]})]);
  await setAccount('alice');
  let wallet = await call('alice');
  assert.equal(wallet.badgeCount,2); assert.equal(wallet.tickets,1);
  assert.deepEqual(wallet.owned,['Sky Blue']);
  const request = randomUUID();
  const drawn = await call('alice',request);
  assert.equal(drawn.tickets,0); assert.equal(drawn.owned.length,2);
  assert.notEqual(drawn.prize,'Sky Blue');
  assert.deepEqual(await call('alice',request),drawn);
  await assert.rejects(call('alice',randomUUID()),/No draw tickets/);
  await assert.rejects(call('bob'),/Student account required/);
  await setAccount('alice'); // Another authenticated device for the same student.
  assert.deepEqual((await call('alice')).owned,drawn.owned);
  // Stale general progress writes must never erase or reimport prizes.
  await db.query("update students set data = data || '{\"lp\":[]}' where id='alice'");
  assert.deepEqual((await call('alice')).owned,drawn.owned);
  await setAccount('bob');
  assert.equal((await call('bob')).owned.length,0);
  const outcomes = await Promise.allSettled([call('bob',randomUUID()),call('bob',randomUUID())]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await call('bob')).owned.length,1);
  const permissions = (await db.query(`select
    has_table_privilege('authenticated','cabinet_wallets','UPDATE') as can_update,
    has_function_privilege('anon','cabinet_account(text,uuid)','EXECUTE') as anon_call,
    has_function_privilege('authenticated','cabinet_account(text,uuid)','EXECUTE') as student_call`)).rows[0];
  assert.deepEqual(permissions,{can_update:false,anon_call:false,student_call:true});
  await db.query("select set_config('test.user','',false)");
  await assert.rejects(call('bob'),/Student account required/);
  await db.close();
  console.log('PASS: legacy import, badge deduplication, account isolation, idempotent retry, overdraw, multiple devices, stale saves, permissions');
})().catch(e=>{console.error(e);process.exitCode=1});
