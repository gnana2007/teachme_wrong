-- TeachMeWrong schema for Supabase PostgreSQL. Run in the SQL editor.
create extension if not exists vector;

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null, email text unique not null,
  role text not null check (role in ('student','professor')),
  created_at timestamptz default now());

create table courses (id uuid primary key default gen_random_uuid(), professor_id uuid references users(id), name text not null);
create table course_students (course_id uuid references courses(id) on delete cascade, student_id uuid references users(id) on delete cascade, primary key (course_id, student_id));

create table concepts (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id), owner_id uuid references users(id),
  name text not null, subject text, description text, difficulty int default 2);
create table knowledge_nodes (id uuid primary key default gen_random_uuid(), concept_id uuid references concepts(id) on delete cascade,
  key text not null, name text not null, description text, parent_id uuid references knowledge_nodes(id), unique (concept_id, key));
create table misconceptions (id uuid primary key default gen_random_uuid(), concept_id uuid references concepts(id) on delete cascade,
  knowledge_node_id uuid references knowledge_nodes(id), statement text not null, severity text, difficulty int, reason text);

create table learning_materials (id uuid primary key default gen_random_uuid(), user_id uuid references users(id), concept_id uuid references concepts(id),
  file_url text, extracted_text text);
create table material_chunks (id uuid primary key default gen_random_uuid(), material_id uuid references learning_materials(id) on delete cascade,
  content text not null, embedding vector(384));
create index on material_chunks using ivfflat (embedding vector_cosine_ops);

create table learning_sessions (id uuid primary key default gen_random_uuid(), student_id uuid references users(id), concept_id uuid references concepts(id),
  status text default 'TEACHING', state jsonb, started_at timestamptz default now(), ended_at timestamptz);
create table messages (id uuid primary key default gen_random_uuid(), session_id uuid references learning_sessions(id) on delete cascade,
  sender text check (sender in ('student','ai')), content text, created_at timestamptz default now());
create table evaluations (id uuid primary key default gen_random_uuid(), session_id uuid references learning_sessions(id) on delete cascade,
  message_id uuid references messages(id), accuracy real, reasoning real, completeness real, concept_coverage real, feedback text, raw jsonb);
create table mastery (id uuid primary key default gen_random_uuid(), student_id uuid references users(id), knowledge_node_id uuid references knowledge_nodes(id),
  mastery_score real, evidence_weight real, updated_at timestamptz default now(), unique (student_id, knowledge_node_id));
create table transfer_tests (id uuid primary key default gen_random_uuid(), session_id uuid references learning_sessions(id) on delete cascade,
  question text, answer text, evaluation jsonb);
create table misconception_events (id uuid primary key default gen_random_uuid(), session_id uuid, student_id uuid, concept_id uuid,
  knowledge_node_id uuid, statement text, corrected boolean, sample text, created_at timestamptz default now());

-- Row-level security: students see only their own data; professors see their courses' students.
alter table learning_sessions enable row level security;
alter table messages enable row level security;
alter table evaluations enable row level security;
alter table mastery enable row level security;
alter table transfer_tests enable row level security;
alter table learning_materials enable row level security;

create policy own_sessions on learning_sessions for all using (student_id = auth.uid());
create policy own_messages on messages for all using (exists (select 1 from learning_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy own_evals on evaluations for all using (exists (select 1 from learning_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy own_transfer on transfer_tests for all using (exists (select 1 from learning_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy own_mastery on mastery for all using (student_id = auth.uid());
create policy own_materials on learning_materials for all using (user_id = auth.uid());
create policy prof_reads_mastery on mastery for select using (exists (
  select 1 from course_students cs join courses c on c.id = cs.course_id
  where cs.student_id = mastery.student_id and c.professor_id = auth.uid()));
