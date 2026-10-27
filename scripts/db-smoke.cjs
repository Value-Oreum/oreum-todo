const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const assert = require("node:assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create publication supabase_realtime;`,
  );
  await db.exec(
    fs.readFileSync(
      require("path").join(__dirname, "../supabase/schema.sql"),
      "utf8",
    ),
  );
  console.log("PASS: PostgreSQL schema executes");
  await db.exec(
    `insert into auth.users values ('00000000-0000-4000-8000-000000000001','eastsea.chae@gmail.com'),('00000000-0000-4000-8000-000000000002','unboundedvalue@gmail.com'),('00000000-0000-4000-8000-000000000003','stranger@example.com');grant usage on schema public,auth to authenticated;grant select,insert,update,delete on tasks to authenticated;grant select on task_events to authenticated;`,
  );
  const users = await db.query(
    "select email,approved,role from members order by email",
  );
  assert.equal(
    users.rows.find((x) => x.email === "stranger@example.com").approved,
    false,
  );
  assert.equal(
    users.rows.find((x) => x.email === "eastsea.chae@gmail.com").role,
    "admin",
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);`,
  );
  assert.equal((await db.query("select * from tasks")).rows.length, 0);
  const t = {
    id: "10000000-0000-4000-8000-000000000001",
    title: "DB smoke",
    company: "Test",
    description: "DB test",
    owner: "eastsea.chae@gmail.com",
    importance: 4,
    urgency: 4,
    difficulty: 2,
    status: "진행 중",
    deleted: false,
    initial: {},
    history: [],
    reminder: true,
    reminder_at: "2020-01-01T00:00:00Z",
    repeat_days: 7,
  };
  let denied = false;
  try {
    await db.query("insert into tasks(id,data) values($1,$2)", [
      t.id,
      JSON.stringify(t),
    ]);
  } catch {
    denied = true;
  }
  assert.ok(denied);
  await db.exec(
    `select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false)`,
  );
  await db.query("insert into tasks(id,data) values($1,$2)", [
    t.id,
    JSON.stringify(t),
  ]);
  let saved = (await db.query("select * from tasks")).rows[0];
  assert.equal(saved.data.initial.importance, 4);
  assert.equal(saved.data.history.length, 1);
  await db.exec(`reset role`);
  let jobs = (await db.query("select * from claim_reminders()")).rows;
  assert.equal(jobs.length, 1);
  assert.equal(
    (await db.query("select * from claim_reminders()")).rows.length,
    0,
  );
  await db.query("select finish_reminder($1,true)", [jobs[0].id]);
  assert.equal(
    (await db.query("select state from reminder_jobs")).rows[0].state,
    "sent",
  );
  assert.equal((await db.query("select * from task_events")).rows.length, 2);
  for (let i = 0; i < 20; i++)
    assert.equal(
      (
        await db.query("select reserve_ai_call($1) as ok", [
          "00000000-0000-4000-8000-000000000001",
        ])
      ).rows[0].ok,
      true,
    );
  assert.equal(
    (
      await db.query("select reserve_ai_call($1) as ok", [
        "00000000-0000-4000-8000-000000000001",
      ])
    ).rows[0].ok,
    false,
  );
  console.log(
    "PASS: initial membership, outsider RLS rejection, task creation, server history/initial values, reminder deduplication and completion, immutable event archive, AI daily cap",
  );
  await db.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
