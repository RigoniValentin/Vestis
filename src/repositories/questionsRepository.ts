import { QuestionModel } from "@models/Question";
import { IQuestionRepository, Question } from "types/QuestionsTypes";
import { Query } from "types/RepositoryTypes";

// Las preguntas se exponen publicamente, asi que del autor solo se cargan
// los datos visibles (nada de email, roles ni datos de acceso).
const PUBLIC_AUTHOR_FIELDS = "name username avatarUrl";

export class QuestionRepository implements IQuestionRepository {
  async create(data: Question): Promise<Question> {
    const newQuestion = new QuestionModel(data);
    return await newQuestion.save();
  }

  async find(query?: Query): Promise<Question[]> {
    return await QuestionModel.find(query || {})
      .sort({ createdAt: -1 })
      .populate("user", PUBLIC_AUTHOR_FIELDS)
      .exec();
  }

  async findById(id: string): Promise<Question | null> {
    return await QuestionModel.findById(id)
      .populate("user", PUBLIC_AUTHOR_FIELDS)
      .exec();
  }

  async update(id: string, data: Partial<Question>): Promise<Question | null> {
    return await QuestionModel.findByIdAndUpdate(id, data, {
      new: true,
    })
      .populate("user", PUBLIC_AUTHOR_FIELDS)
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await QuestionModel.findByIdAndDelete(id).exec();
    return deleted !== null;
  }

  async count(query: Query): Promise<number> {
    return await QuestionModel.countDocuments(query).exec();
  }
}
