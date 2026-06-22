import { Request, Response } from "express";
import { QuestionsService } from "@services/questionsService";
import { QuestionRepository } from "@repositories/questionsRepository";
import { Query } from "types/RepositoryTypes";
import { Question, QuestionResponsePayload } from "types/QuestionsTypes";

const questionsService = new QuestionsService(new QuestionRepository());

const isAdminUser = (req: Request) =>
  req.currentUser.roles?.some((role) => role.name === "admin");

export const createQuestion = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.currentUser._id;
    const text = String(req.body.text || "").trim();
    const category = String(req.body.category || req.body.topic || "").trim();

    if (!text || !category) {
      res
        .status(400)
        .json({ message: "La pregunta y la categoría son obligatorias." });
      return;
    }

    const questionData = {
      text,
      category,
      user: userId,
    } as Question;

    const newQuestion = await questionsService.createQuestion(questionData);
    res.status(201).json(newQuestion);
  } catch (error) {
    res
      .status(400)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const respondToQuestion = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo Liz puede responder preguntas." });
      return;
    }

    const id = req.params.id as string;
    const payload = req.body as QuestionResponsePayload;

    const answered = await questionsService.respondToQuestion(id, payload);
    if (!answered) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }

    res.json(answered);
  } catch (error) {
    res
      .status(400)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const answerQuestionVideo1 = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo Liz puede responder preguntas." });
      return;
    }

    const id = req.params.id as string;
    const { videoUrl } = req.body;
    if (!videoUrl || !videoUrl.trim()) {
      res.status(400).json({ message: "El link del video es obligatorio." });
      return;
    }
    const answered = await questionsService.answerQuestionVideo1(id, videoUrl);
    if (!answered) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.json(answered);
  } catch (error) {
    res
      .status(500)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const answerQuestionVideo2 = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo Liz puede responder preguntas." });
      return;
    }

    const id = req.params.id as string;
    const { videoUrl } = req.body;
    if (!videoUrl || !videoUrl.trim()) {
      res.status(400).json({ message: "El link del video es obligatorio." });
      return;
    }
    const answered = await questionsService.answerQuestionVideo2(id, videoUrl);
    if (!answered) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.json(answered);
  } catch (error) {
    res
      .status(500)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const rejectQuestion = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo Liz puede moderar preguntas." });
      return;
    }

    const id = req.params.id as string;
    const { rejectComment } = req.body;
    if (!rejectComment) {
      res
        .status(400)
        .json({ message: "El comentario de rechazo es obligatorio." });
      return;
    }
    const rejected = await questionsService.rejectQuestion(id, rejectComment);
    if (!rejected) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.json(rejected);
  } catch (error) {
    res
      .status(500)
      .json({ message: error instanceof Error ? error.message : error });
  }
};

export const findQuestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query: Query = { ...req.query };

    if (!isAdminUser(req)) {
      query.user = String(req.currentUser._id);
    }

    const questions = await questionsService.findQuestions(query);
    res.json(questions);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Ocurrió un error inesperado.",
    });
  }
};
