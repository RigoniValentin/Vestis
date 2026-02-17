"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findQuestions = exports.rejectQuestion = exports.answerQuestionVideo2 = exports.answerQuestionVideo1 = exports.createQuestion = void 0;
const questionsService_1 = require("@services/questionsService");
const questionsRepository_1 = require("@repositories/questionsRepository");
const questionsService = new questionsService_1.QuestionsService(new questionsRepository_1.QuestionRepository());
const createQuestion = async (req, res) => {
    try {
        // Usa req.currentUser para saber quién hace la pregunta
        const userId = req.currentUser._id;
        const questionData = {
            ...req.body,
            user: userId,
        };
        const newQuestion = await questionsService.createQuestion(questionData);
        res.status(201).json(newQuestion);
    }
    catch (error) {
        res
            .status(400)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.createQuestion = createQuestion;
// Endpoint para que admin responda una pregunta
// Endpoint para responder con el primer video
const answerQuestionVideo1 = async (req, res) => {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.answerQuestionVideo1 = answerQuestionVideo1;
// Endpoint para responder con el segundo video
const answerQuestionVideo2 = async (req, res) => {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.answerQuestionVideo2 = answerQuestionVideo2;
const rejectQuestion = async (req, res) => {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.rejectQuestion = rejectQuestion;
const findQuestions = async (req, res) => {
    try {
        // Opcional: Si el usuario no es admin, puedes filtrar por su id, por ejemplo:
        // const query = { ...req.query, user: req.currentUser._id };
        const query = req.query;
        const questions = await questionsService.findQuestions(query);
        res.json(questions);
    }
    catch (error) {
        res.status(500).json({
            message: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
    }
};
exports.findQuestions = findQuestions;
// Puedes agregar endpoints GET para que los usuarios consulten
// sus preguntas pendientes y respondidas, filtrando por req.currentUser._id y status.
