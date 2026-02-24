export interface JudgeAssignment {
  assignmentId: string;
  judgeId: string;
  categoryId: string;
  status: 'active' | 'finished';
}
