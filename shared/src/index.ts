export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

export interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  passageCount: number;
  readCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface TodayPassage {
  id: string;
  content: string;
  estimatedMinutes: number;
  bookTitle: string;
  chunkIndex: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
}

export interface QuizResponse {
  id: string;
  passageId: string;
  questions: QuizQuestion[];
}

export interface QuizSubmissionResult {
  success: boolean;
  score: number;
  streak: number;
}

export interface UserSettings {
  targetReadingTime: string; // HH:mm
  timezone: string;
  baseWPM: number;
  selectedAlarmTone: string;
  isTimeLocked: boolean;
}

export interface AlarmStatus {
  isAlarmActive: boolean;
  activatedAt: Date | null;
  currentStreak: number;
}
