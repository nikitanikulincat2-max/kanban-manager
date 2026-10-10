export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser?: boolean;
  is_manager?: boolean;
}

export interface WorkspaceMembership {
  id: number;
  user: User;
  role: 'manager' | 'member';     // ← обновлено: admin → manager
  joined_at: string;
}

export interface Workspace {
  id: number;
  name: string;
  created_by: User;
  created_at: string;
  memberships: WorkspaceMembership[];
}

export interface Board {
  id: number;
  workspace: number;
  name: string;
  description: string;
  created_at: string;
  order: number;
}

export interface Column {
  id: number;
  board: number;
  name: string;
  order: number;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  column: number;
  title: string;
  description: string;
  assignee: User | null;
  created_by: User;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  order: number;
  created_at: string;
  updated_at: string;
  labels: Label[];
  comments_count: number;
  visibility: VisibilityType;
  group: number | null;
  group_name?: string;
}

export interface Comment {
  id: number;
  task: number;
  author: User;
  text: string;
  created_at: string;
}

export interface TaskHistory {
  id: number;
  task: number;
  user: User;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Attachment {
  id: number;
  task: number;
  file: string;
  file_url: string;
  uploaded_by: User;
  uploaded_at: string;
}

export type VisibilityType = 'public' | 'private' | 'group';

export interface TaskGroupMembership {
  id: number;
  user: User;
  added_at: string;
}

export interface TaskGroup {
  id: number;
  workspace: number;
  workspace_name?: string;
  name: string;
  description: string;
  created_by: User;
  created_at: string;
  memberships: TaskGroupMembership[];
  members_count: number;
}