import { Document, Types } from "mongoose";
import { Query, Repository } from "./RepositoryTypes";

export type QuestionStatus = "pending" | "answered" | "rejected";
export type QuestionResponseType = "text" | "youtube";

export interface QuestionResponsePayload {
  responseType: QuestionResponseType;
  responseText?: string;
  responseVideoUrl?: string;
}

export interface Question extends Document {
  text: string;
  category: string;
  status: QuestionStatus;
  user: Types.ObjectId;
  responseType?: QuestionResponseType;
  responseText?: string;
  responseVideoUrl?: string;
  respondedAt?: Date;
  answerUrls?: string[];
  rejectComment?: string;
  rejectedAt?: Date;
}

// Puedes aprovechar la interface Repository de RepositoryTypes para los métodos comunes
export interface IQuestionRepository extends Repository<Question> {
  count(query: Query): Promise<number>;
}

export interface IQuestionService {
  createQuestion(question: Question): Promise<Question>;
  findQuestions(query?: Query): Promise<Question[]>;
  findQuestionById(id: string): Promise<Question | null>;
  updateQuestion(id: string, data: Partial<Question>): Promise<Question | null>;
  deleteQuestion(id: string): Promise<boolean>;
  respondToQuestion(
    id: string,
    response: QuestionResponsePayload
  ): Promise<Question | null>;
  answerQuestionVideo1(id: string, videoUrl: string): Promise<Question | null>;
  answerQuestionVideo2(id: string, videoUrl: string): Promise<Question | null>;
  rejectQuestion(id: string, rejectComment: string): Promise<Question | null>;
}
