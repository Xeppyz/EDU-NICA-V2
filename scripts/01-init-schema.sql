-- Create users table with role management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create classes table for course organization
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Short code teachers can share with students to join the class
  join_code TEXT UNIQUE,
  description TEXT,
  subject TEXT DEFAULT 'Lengua y Literatura',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table for organized content
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  lsn_video_url TEXT,
  pdf_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create glossary table with multimedia support
CREATE TABLE IF NOT EXISTS glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  audio_url TEXT,
  lsn_video_url TEXT,
  lsn_video_storage_path TEXT,
  category TEXT,
  example_sentence TEXT,
  handshape TEXT,
  difficulty TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.glossary
  ADD COLUMN IF NOT EXISTS lsn_video_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS example_sentence TEXT,
  ADD COLUMN IF NOT EXISTS handshape TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- Create activities table for interactive exercises
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quiz', 'exercise', 'reading', 'fill_blank', 'matching', 'dragdrop', 'coding')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure the activities.type constraint includes our extended set (idempotent)
ALTER TABLE IF EXISTS public.activities
  DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE IF EXISTS public.activities
  ADD CONSTRAINT activities_type_check CHECK (type IN ('quiz', 'exercise', 'reading', 'fill_blank', 'matching', 'dragdrop', 'coding'));

-- Ensure the users.role constraint includes 'admin' (idempotent)
ALTER TABLE IF EXISTS public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'student', 'admin'));

-- Create evaluations table for assessments
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  -- type indicates the kind of evaluation: 'quiz' (default), 'fill_blank', 'matching', 'dragdrop', 'coding'
  type TEXT DEFAULT 'quiz',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add scheduling and attempts columns for evaluations if they don't exist yet
ALTER TABLE IF EXISTS public.evaluations
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS attempts_allowed INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS student_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create challenges (desafíos) table: a challenge belongs to a class and is authored by a teacher
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- types for the challenge (multiple choice, fill blank, select image, matching, dragdrop, coding, open_ended, sign_practice)
  type TEXT NOT NULL CHECK (type IN ('multiple_choice','fill_blank','select_image','matching','dragdrop','coding','open_ended','sign_practice')) DEFAULT 'multiple_choice',
  -- payload holds question/choices/media in a flexible JSONB shape
  payload JSONB,
  -- optional structured rubric definition (array of criteria with weights)
  rubric JSONB,
  -- optional target score teachers can override per challenge (used by rubric scoring)
  max_score NUMERIC DEFAULT 100,
  -- optional reference video for sign practice prompts
  reference_video_storage_path TEXT,
  reference_video_duration_seconds INTEGER,
  reference_video_transcript TEXT,
  start_at TIMESTAMP WITH TIME ZONE,
  due_at TIMESTAMP WITH TIME ZONE,
  attempts_allowed INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Responses submitted by students for a given challenge
CREATE TABLE IF NOT EXISTS challenge_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score NUMERIC,
  rubric_scores JSONB,
  teacher_feedback TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending','needs_revision','approved')) DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  submission_storage_path TEXT,
  submission_duration_seconds INTEGER,
  submission_transcript TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure the challenges.type constraint includes new experiential types
ALTER TABLE IF EXISTS public.challenges
  DROP CONSTRAINT IF EXISTS challenges_type_check;

ALTER TABLE IF EXISTS public.challenges
  ADD CONSTRAINT challenges_type_check CHECK (type IN ('multiple_choice','fill_blank','select_image','matching','dragdrop','coding','open_ended','sign_practice'));

-- Backfill columns for experiential sign practice metadata (idempotent)
ALTER TABLE IF EXISTS public.challenges
  ADD COLUMN IF NOT EXISTS rubric JSONB,
  ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reference_video_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS reference_video_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS reference_video_transcript TEXT;

ALTER TABLE IF EXISTS public.challenge_responses
  ADD COLUMN IF NOT EXISTS rubric_scores JSONB,
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','needs_revision','approved')),
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS submission_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS submission_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS submission_transcript TEXT;

-- Helpful indexes for reporting & reviews
CREATE INDEX IF NOT EXISTS idx_challenges_class_id ON public.challenges(class_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_challenge_id ON public.challenge_responses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_student_id ON public.challenge_responses(student_id);

-- Create student progress tracking
CREATE TABLE IF NOT EXISTS student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  progress_percentage INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_accessed TIMESTAMP WITH TIME ZONE,
  UNIQUE(student_id, class_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- Create forum posts table
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create forum replies table
CREATE TABLE IF NOT EXISTS forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary ENABLE ROW LEVEL SECURITY;


ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;

-- Allow admins to bypass most RLS checks by granting them full access via policies.
-- These policies check that the calling user has a row in public.users with role = 'admin'.
-- They are intentionally permissive; review before applying to production.

DROP POLICY IF EXISTS "Admins can manage all" ON public.users;
CREATE POLICY "Admins can manage all"
  ON users FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.classes;
CREATE POLICY "Admins can manage all"
  ON classes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.lessons;
CREATE POLICY "Admins can manage all"
  ON lessons FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.glossary;
CREATE POLICY "Admins can manage all"
  ON glossary FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.activities;
CREATE POLICY "Admins can manage all"
  ON activities FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.evaluations;
CREATE POLICY "Admins can manage all"
  ON evaluations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.student_responses;
CREATE POLICY "Admins can manage all"
  ON student_responses FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.student_progress;
CREATE POLICY "Admins can manage all"
  ON student_progress FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.class_enrollments;
CREATE POLICY "Admins can manage all"
  ON class_enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.forum_posts;
CREATE POLICY "Admins can manage all"
  ON forum_posts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage all" ON public.forum_replies;
CREATE POLICY "Admins can manage all"
  ON forum_replies FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- RLS Policies for users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile (when signing up)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT WITH CHECK (auth.uid() = id);


-- Allow teachers to view users (students) that are enrolled in their classes
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.users;
CREATE POLICY "Teachers can view students in their classes"
  ON users FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_enrollments ce
      JOIN classes c ON ce.class_id = c.id
      WHERE ce.student_id = users.id
      AND c.teacher_id = auth.uid()
    )
  );


-- Function to sync auth.users (managed by Supabase Auth) into public.users
-- This creates/updates a row in public.users when a user is created/updated in auth schema
CREATE OR REPLACE FUNCTION public.handle_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      (NEW.raw_user_meta_data->>'full_name')::text,
      COALESCE((NEW.raw_user_meta_data->>'role')::text, 'student'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.users
    SET
      email = NEW.email,
      full_name = NEW.raw_user_meta_data->>'full_name',
      role = COALESCE(NEW.raw_user_meta_data->>'role', public.users.role),
      updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger function runs with an owner that can bypass RLS checks
-- This helps SECURITY DEFINER to actually avoid recursive policy evaluation
-- (requires permission to set owner; Supabase projects usually allow altering to 'postgres')
ALTER FUNCTION public.handle_auth_user() OWNER TO postgres;

-- Create trigger in auth schema to call the sync function after insert or update on auth.users
DROP TRIGGER IF EXISTS auth_user_change ON auth.users;
CREATE TRIGGER auth_user_change
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user();

-- RLS Policies for classes
DROP POLICY IF EXISTS "Teachers can create classes" ON public.classes;
CREATE POLICY "Teachers can create classes"
  ON classes FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Anyone can view classes they're enrolled in or teaching" ON public.classes;
CREATE POLICY "Anyone can view classes they're enrolled in or teaching"
  ON classes FOR SELECT USING (
    auth.uid() = teacher_id 
    OR EXISTS (
      SELECT 1 FROM class_enrollments 
      WHERE class_enrollments.class_id = classes.id 
      AND class_enrollments.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
CREATE POLICY "Teachers can update their own classes"
  ON classes FOR UPDATE USING (auth.uid() = teacher_id);

-- Allow authenticated users to discover classes (needed to find by join_code before enrolling)
DROP POLICY IF EXISTS "Authenticated users can view classes" ON public.classes;
CREATE POLICY "Authenticated users can view classes" 
  ON classes FOR SELECT USING (auth.uid() IS NOT NULL);

-- Helper function used by policies to avoid recursive policy evaluation
-- This function checks ownership of a class and is SECURITY DEFINER so
-- it can read the classes table without invoking RLS (prevents recursion).
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(cid UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM classes WHERE id = cid AND teacher_id = uid);
$$;

-- Make the helper function owned by postgres so it can run without invoking RLS
ALTER FUNCTION public.is_teacher_of_class(uuid, uuid) OWNER TO postgres;

-- RLS policies for glossary (placed after helper function so is_teacher_of_class exists)
DROP POLICY IF EXISTS "Teachers can manage glossary entries" ON public.glossary;
CREATE POLICY "Teachers can manage glossary entries"
  ON glossary FOR ALL USING (public.is_teacher_of_class(class_id, auth.uid())) WITH CHECK (public.is_teacher_of_class(class_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view glossary for their classes" ON public.glossary;
CREATE POLICY "Anyone can view glossary for their classes"
  ON glossary FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = glossary.class_id
      AND (
        classes.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_enrollments
          WHERE class_enrollments.class_id = classes.id
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );


-- RLS Policies for lessons
DROP POLICY IF EXISTS "Anyone can view lessons from their classes" ON public.lessons;
CREATE POLICY "Anyone can view lessons from their classes"
  ON lessons FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = lessons.class_id 
      AND (
        classes.teacher_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM class_enrollments 
          WHERE class_enrollments.class_id = classes.id 
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );

-- Allow teachers to create/update/delete lessons for their own classes
DROP POLICY IF EXISTS "Teachers can manage lessons" ON public.lessons;
CREATE POLICY "Teachers can manage lessons"
  ON lessons FOR ALL USING (public.is_teacher_of_class(class_id, auth.uid())) WITH CHECK (public.is_teacher_of_class(class_id, auth.uid()));

-- RLS Policies for activities
DROP POLICY IF EXISTS "Anyone can view activities for their classes" ON public.activities;
CREATE POLICY "Anyone can view activities for their classes"
  ON activities FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN classes ON classes.id = lessons.class_id
      WHERE lessons.id = activities.lesson_id
      AND (
        classes.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_enrollments
          WHERE class_enrollments.class_id = classes.id
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teachers can manage activities" ON public.activities;
CREATE POLICY "Teachers can manage activities"
  ON activities FOR ALL USING (
    -- teacher must be owner of the class that contains the lesson this activity belongs to
    public.is_teacher_of_class((SELECT classes.id FROM lessons JOIN classes ON classes.id = lessons.class_id WHERE lessons.id = activities.lesson_id), auth.uid())
  ) WITH CHECK (
    public.is_teacher_of_class((SELECT classes.id FROM lessons JOIN classes ON classes.id = lessons.class_id WHERE lessons.id = activities.lesson_id), auth.uid())
  );

-- RLS Policies for student_responses
DROP POLICY IF EXISTS "Students can view their own responses" ON public.student_responses;
CREATE POLICY "Students can view their own responses"
  ON student_responses FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view responses from their class" ON public.student_responses;
CREATE POLICY "Teachers can view responses from their class"
  ON student_responses FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluations
      JOIN activities ON activities.id = evaluations.activity_id
      JOIN lessons ON lessons.id = activities.lesson_id
      JOIN classes ON classes.id = lessons.class_id
      WHERE evaluations.id = student_responses.evaluation_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- RLS Policies for challenges (desafíos)
DROP POLICY IF EXISTS "Teachers can create challenges" ON public.challenges;
CREATE POLICY "Teachers can create challenges"
  ON challenges FOR INSERT WITH CHECK (auth.uid() = teacher_id AND public.is_teacher_of_class(class_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view challenges for their classes" ON public.challenges;
CREATE POLICY "Anyone can view challenges for their classes"
  ON challenges FOR SELECT USING (
    auth.uid() = teacher_id
    OR EXISTS (
      SELECT 1 FROM class_enrollments ce WHERE ce.class_id = challenges.class_id AND ce.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can manage challenges" ON public.challenges;
CREATE POLICY "Teachers can manage challenges"
  ON challenges FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- RLS Policies for challenge_responses
DROP POLICY IF EXISTS "Students can submit challenge responses" ON public.challenge_responses;
CREATE POLICY "Students can submit challenge responses"
  ON challenge_responses FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view their own challenge responses" ON public.challenge_responses;
CREATE POLICY "Students can view their own challenge responses"
  ON challenge_responses FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view challenge responses for their classes" ON public.challenge_responses;
CREATE POLICY "Teachers can view challenge responses for their classes"
  ON challenge_responses FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges c JOIN classes cl ON cl.id = c.class_id WHERE c.id = challenge_responses.challenge_id AND cl.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors or teachers can update challenge responses" ON public.challenge_responses;
CREATE POLICY "Authors or teachers can update challenge responses"
  ON challenge_responses FOR UPDATE USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenges c JOIN classes cl ON cl.id = c.class_id WHERE c.id = challenge_responses.challenge_id AND cl.teacher_id = auth.uid()
    )
  ) WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenges c JOIN classes cl ON cl.id = c.class_id WHERE c.id = challenge_responses.challenge_id AND cl.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors or teachers can delete challenge responses" ON public.challenge_responses;
CREATE POLICY "Authors or teachers can delete challenge responses"
  ON challenge_responses FOR DELETE USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenges c JOIN classes cl ON cl.id = c.class_id WHERE c.id = challenge_responses.challenge_id AND cl.teacher_id = auth.uid()
    )
  );

-- RLS for class_enrollments: allow students to insert themselves and view their enrollments
DROP POLICY IF EXISTS "Students can view their enrollments" ON public.class_enrollments;
CREATE POLICY "Students can view their enrollments"
  ON class_enrollments FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can enroll themselves" ON public.class_enrollments;
CREATE POLICY "Students can enroll themselves"
  ON class_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Allow teachers to view enrollments for their classes OR students to view their own
DROP POLICY IF EXISTS "Students or teachers can view enrollments" ON public.class_enrollments;
CREATE POLICY "Students or teachers can view enrollments"
  ON class_enrollments FOR SELECT USING (
    auth.uid() = student_id
    OR public.is_teacher_of_class(class_id, auth.uid())
  );

-- RLS for student_progress: students can insert/select their own progress
DROP POLICY IF EXISTS "Students can manage their progress (select)" ON public.student_progress;
CREATE POLICY "Students can manage their progress (select)"
  ON student_progress FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can initialize their progress (insert)" ON public.student_progress;
CREATE POLICY "Students can initialize their progress (insert)"
  ON student_progress FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Teachers can view progress for their classes
DROP POLICY IF EXISTS "Teachers can view student progress for their classes" ON public.student_progress;
CREATE POLICY "Teachers can view student progress for their classes"
  ON student_progress FOR SELECT USING (
    public.is_teacher_of_class(class_id, auth.uid())
  );


-- RLS policies for forum_posts
DROP POLICY IF EXISTS "Anyone can view forum posts for their classes" ON public.forum_posts;
CREATE POLICY "Anyone can view forum posts for their classes"
  ON forum_posts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = forum_posts.class_id
      AND (
        classes.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_enrollments
          WHERE class_enrollments.class_id = classes.id
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Students and teachers can create posts" ON public.forum_posts;
CREATE POLICY "Students and teachers can create posts"
  ON forum_posts FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_teacher_of_class(class_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM class_enrollments
        WHERE class_enrollments.class_id = forum_posts.class_id
        AND class_enrollments.student_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authors or teachers can update posts" ON public.forum_posts;
CREATE POLICY "Authors or teachers can update posts"
  ON forum_posts FOR UPDATE USING (
    author_id = auth.uid() OR public.is_teacher_of_class(class_id, auth.uid())
  ) WITH CHECK (
    author_id = auth.uid() OR public.is_teacher_of_class(class_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors or teachers can delete posts" ON public.forum_posts;
CREATE POLICY "Authors or teachers can delete posts"
  ON forum_posts FOR DELETE USING (
    author_id = auth.uid() OR public.is_teacher_of_class(class_id, auth.uid())
  );


-- RLS policies for forum_replies
DROP POLICY IF EXISTS "Anyone can view replies for posts in their classes" ON public.forum_replies;
CREATE POLICY "Anyone can view replies for posts in their classes"
  ON forum_replies FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forum_posts
      JOIN classes ON classes.id = forum_posts.class_id
      WHERE forum_posts.id = forum_replies.post_id
      AND (
        classes.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_enrollments
          WHERE class_enrollments.class_id = classes.id
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Students and teachers can create replies" ON public.forum_replies;
CREATE POLICY "Students and teachers can create replies"
  ON forum_replies FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM forum_posts
      JOIN classes ON classes.id = forum_posts.class_id
      WHERE forum_posts.id = forum_replies.post_id
      AND (
        classes.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_enrollments
          WHERE class_enrollments.class_id = classes.id
          AND class_enrollments.student_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Authors or teachers can update replies" ON public.forum_replies;
CREATE POLICY "Authors or teachers can update replies"
  ON forum_replies FOR UPDATE USING (
    author_id = auth.uid() OR EXISTS (
      SELECT 1 FROM forum_posts JOIN classes ON classes.id = forum_posts.class_id
      WHERE forum_posts.id = forum_replies.post_id AND public.is_teacher_of_class(classes.id, auth.uid())
    )
  ) WITH CHECK (
    author_id = auth.uid() OR EXISTS (
      SELECT 1 FROM forum_posts JOIN classes ON classes.id = forum_posts.class_id
      WHERE forum_posts.id = forum_replies.post_id AND public.is_teacher_of_class(classes.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors or teachers can delete replies" ON public.forum_replies;
CREATE POLICY "Authors or teachers can delete replies"
  ON forum_replies FOR DELETE USING (
    author_id = auth.uid() OR EXISTS (
      SELECT 1 FROM forum_posts JOIN classes ON classes.id = forum_posts.class_id
      WHERE forum_posts.id = forum_replies.post_id AND public.is_teacher_of_class(classes.id, auth.uid())
    )
  );
