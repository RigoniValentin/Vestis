import { Query } from "types/RepositoryTypes";
import {
  IQuestionRepository,
  QuestionResponsePayload,
  IQuestionService,
  Question,
} from "types/QuestionsTypes";

export class QuestionsService implements IQuestionService {
  private questionRepository: IQuestionRepository;

  constructor(questionRepository: IQuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async createQuestion(question: Question): Promise<Question> {
    const pendingCount = await this.questionRepository.count({
      category: (question as any).category,
      status: "pending",
    });

    console.log("Pending count", pendingCount);

    if (pendingCount >= 3) {
      throw new Error(
        "Se alcanzó el límite de 3 preguntas pendientes para esta categoría. Espere a que el administrador responda alguna para agregar otra."
      );
    }

    question.status = "pending";
    question.responseType = undefined;
    question.responseText = undefined;
    question.responseVideoUrl = undefined;
    question.respondedAt = undefined;
    question.rejectComment = undefined;
    question.rejectedAt = undefined;
    return this.questionRepository.create(question);
  }

  async findQuestions(query?: Query): Promise<Question[]> {
    return this.questionRepository.find(query);
  }

  async findQuestionById(id: string): Promise<Question | null> {
    return this.questionRepository.findById(id);
  }

  async updateQuestion(
    id: string,
    data: Partial<Question>
  ): Promise<Question | null> {
    return this.questionRepository.update(id, data);
  }

  async deleteQuestion(id: string): Promise<boolean> {
    return this.questionRepository.delete(id);
  }

  async respondToQuestion(
    id: string,
    response: QuestionResponsePayload
  ): Promise<Question | null> {
    const question = await this.questionRepository.findById(id);
    if (!question) {
      throw new Error("Pregunta no encontrada.");
    }

    if (!["text", "youtube"].includes(response.responseType)) {
      throw new Error("El tipo de respuesta debe ser 'text' o 'youtube'.");
    }

    const responseText = response.responseText?.trim();
    const responseVideoUrl = response.responseVideoUrl?.trim();

    if (response.responseType === "text" && !responseText) {
      throw new Error("La respuesta escrita es obligatoria.");
    }

    if (response.responseType === "youtube" && !responseVideoUrl) {
      throw new Error("El link del video de YouTube es obligatorio.");
    }

    return this.questionRepository.update(id, {
      status: "answered",
      responseType: response.responseType,
      responseText: response.responseType === "text" ? responseText : undefined,
      responseVideoUrl:
        response.responseType === "youtube" ? responseVideoUrl : undefined,
      respondedAt: new Date(),
      rejectComment: undefined,
      rejectedAt: undefined,
    });
  }

  async answerQuestionVideo1(
    id: string,
    videoUrl: string
  ): Promise<Question | null> {
    const trimmedVideoUrl = videoUrl?.trim();
    if (!trimmedVideoUrl) {
      throw new Error("Debe proporcionar una URL de video válida.");
    }

    const question = await this.questionRepository.findById(id);
    if (!question) {
      throw new Error("Pregunta no encontrada.");
    }

    const newAnswerUrls = question.answerUrls || [];
    newAnswerUrls[0] = trimmedVideoUrl;
    return this.questionRepository.update(id, {
      answerUrls: newAnswerUrls,
      status: "answered",
      responseType: "youtube",
      responseText: undefined,
      responseVideoUrl: trimmedVideoUrl,
      respondedAt: new Date(),
      rejectComment: undefined,
      rejectedAt: undefined,
    });
  }

  async answerQuestionVideo2(
    id: string,
    videoUrl: string
  ): Promise<Question | null> {
    const trimmedVideoUrl = videoUrl?.trim();
    if (!trimmedVideoUrl) {
      throw new Error("Debe proporcionar una URL de video válida.");
    }

    const question = await this.questionRepository.findById(id);
    if (!question) {
      throw new Error("Pregunta no encontrada.");
    }

    const newAnswerUrls = question.answerUrls || [];
    newAnswerUrls[1] = trimmedVideoUrl;
    return this.questionRepository.update(id, {
      answerUrls: newAnswerUrls,
      status: "answered",
      responseType: "youtube",
      responseText: undefined,
      responseVideoUrl: newAnswerUrls[0] || trimmedVideoUrl,
      respondedAt: question.respondedAt || new Date(),
      rejectComment: undefined,
      rejectedAt: undefined,
    });
  }

  async rejectQuestion(
    id: string,
    rejectComment: string
  ): Promise<Question | null> {
    const trimmedRejectComment = rejectComment?.trim();
    if (!trimmedRejectComment) {
      throw new Error("El comentario de rechazo es obligatorio.");
    }

    return this.questionRepository.update(id, {
      rejectComment: trimmedRejectComment,
      status: "rejected",
      responseType: undefined,
      responseText: undefined,
      responseVideoUrl: undefined,
      respondedAt: undefined,
      rejectedAt: new Date(),
    });
  }
}
