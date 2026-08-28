-- Run once in Supabase Dashboard > SQL Editor.
-- Keeps existing rows and changes only the students.id type.

alter table public.students
  alter column id type text using id::text;
