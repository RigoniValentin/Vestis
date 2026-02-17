"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVideoByUrl = exports.deleteVideo = exports.updateVideoByCombo = exports.updateVideo = exports.findVideoById = exports.findVideos = exports.createVideo = void 0;
const videosService_1 = require("@services/videosService");
const videosRepository_1 = require("@repositories/videosRepository");
const videosService = new videosService_1.VideosService(new videosRepository_1.VideoRepository());
const createVideo = async (req, res) => {
    try {
        const videoData = req.body;
        const newVideo = await videosService.createVideo(videoData);
        res.status(201).json(newVideo);
    }
    catch (error) {
        if (error instanceof Error) {
            // Aquí se retorna un error específico al cliente
            res.status(400).json({ message: error.message });
        }
        else {
            res.status(400).json({ message: "Ocurrió un error inesperado" });
        }
    }
};
exports.createVideo = createVideo;
const findVideos = async (req, res) => {
    try {
        // Se pueden agregar filtros por query string si se desean
        const query = req.query;
        const videos = await videosService.findVideos(query);
        res.json(videos);
    }
    catch (error) {
        res.status(500).json(error);
    }
};
exports.findVideos = findVideos;
const findVideoById = async (req, res) => {
    try {
        const id = req.params.id;
        const video = await videosService.findVideoById(id);
        if (!video) {
            res.status(404).json({ message: "Video not found" });
            return;
        }
        res.json(video);
    }
    catch (error) {
        res.status(500).json(error);
    }
};
exports.findVideoById = findVideoById;
const updateVideo = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        const updatedVideo = await videosService.updateVideo(id, data);
        if (!updatedVideo) {
            res.status(404).json({ message: "Video not found" });
            return;
        }
        res.json(updatedVideo);
    }
    catch (error) {
        res.status(500).json(error);
    }
};
exports.updateVideo = updateVideo;
const updateVideoByCombo = async (req, res) => {
    try {
        // Se espera que el cliente envíe en el body la combinación que identifica el video (url, category, trainingType, level, muscleGroup)
        // y un campo newUrl con la nueva URL a asignar
        const { url, category, trainingType, level, muscleGroup, newUrl } = req.body;
        if (!url || !category || !newUrl) {
            res
                .status(400)
                .json({ message: "Falta información para actualizar el video." });
            return;
        }
        const query = { url, category, trainingType, level, muscleGroup };
        const updatedVideo = await videosService.updateVideoByCombo(query, newUrl);
        if (!updatedVideo) {
            res.status(404).json({ message: "Video no encontrado." });
            return;
        }
        res.json(updatedVideo);
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ message: error.message });
        }
        else {
            res.status(500).json({ message: "Ocurrió un error inesperado." });
        }
    }
};
exports.updateVideoByCombo = updateVideoByCombo;
const deleteVideo = async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await videosService.deleteVideo(id);
        if (!deleted) {
            res.status(404).json({ message: "Video not found" });
            return;
        }
        res.json({ message: "Video deleted" });
    }
    catch (error) {
        res.status(500).json(error);
    }
};
exports.deleteVideo = deleteVideo;
const deleteVideoByUrl = async (req, res) => {
    try {
        const { url } = req.query; // Esperamos que la URL venga como query parameter
        if (typeof url !== "string") {
            res.status(400).json({ message: "URL is required and must be a string" });
            return;
        }
        const deleted = await videosService.deleteVideoByUrl(url);
        if (!deleted) {
            res.status(404).json({ message: "Video not found" });
            return;
        }
        res.json({ message: "Video deleted successfully" });
    }
    catch (error) {
        res.status(500).json(error);
    }
};
exports.deleteVideoByUrl = deleteVideoByUrl;
