-- Zadoox Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- Description: Sets up RLS policies for all tables

-- ============================================
-- User Profiles RLS Policies
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (usually handled by trigger)
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- Projects RLS Policies
-- ============================================

-- Users can view projects they own
CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can create projects
CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  USING (auth.uid() = owner_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- Documents RLS Policies
-- ============================================

-- Users can view documents in projects they own
CREATE POLICY "Users can view documents in own projects"
  ON documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = documents.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can create documents in projects they own
CREATE POLICY "Users can create documents in own projects"
  ON documents
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = documents.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can update documents in projects they own
CREATE POLICY "Users can update documents in own projects"
  ON documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = documents.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can delete documents in projects they own
CREATE POLICY "Users can delete documents in own projects"
  ON documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = documents.project_id
      AND projects.owner_id = auth.uid()
    )
  );

