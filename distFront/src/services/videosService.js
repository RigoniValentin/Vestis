"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideosService = void 0;
class VideosService {
    constructor(videoRepository) {
        this.videoRepository = videoRepository;
    }
    async createVideo(video) {
        const duplicateQuery = {
            url: video.url,
            category: video.category,
            trainingType: video.trainingType,
            level: video.level,
            muscleGroup: video.muscleGroup,
        };
        const existingVideos = await this.videoRepository.find(duplicateQuery);
        if (existingVideos.length > 0) {
            throw new Error("Ya existe el video con la misma combinación de categoría, tipo de entrenamiento, nivel y grupo muscular.");
        }
        return this.videoRepository.create(video);
    }
    async findVideos(query) {
        return this.videoRepository.find(query);
    }
    async findVideoById(id) {
        return this.videoRepository.findById(id);
    }
    async updateVideo(id, data) {
        return this.videoRepository.update(id, data);
    }
    async deleteVideo(id) {
        return this.videoRepository.delete(id);
    }
    async deleteVideoByUrl(url) {
        return this.videoRepository.deleteByUrl(url);
    }
    async updateVideoByCombo(query, newUrl) {
        // 1. Buscar el video actual según la combinación enviada
        const videoToUpdate = await this.videoRepository.findOne(query);
        if (!videoToUpdate) {
            throw new Error("Video no encontrado para la combinación indicada.");
        }
        // 2. Buscar si la nueva URL ya está asignada a otro video con la misma configuración
        const duplicateQuery = {
            url: newUrl,
            category: query.category,
            trainingType: query.trainingType,
            level: query.level,
            muscleGroup: query.muscleGroup,
            // Asegurarse de excluir el video que se va a actualizar
            _id: { $ne: videoToUpdate._id },
        };
        const duplicates = await this.videoRepository.find(duplicateQuery);
        if (duplicates.length > 0) {
            throw new Error("La nueva URL ya existe en otro video con la misma categoría, tipo de entrenamiento, nivel y grupo muscular.");
        }
        // 3. Actualizar el video usando la combinación (ya que se sabe cuál es) y reemplazar la url
        return await this.videoRepository.updateByCombo(query, newUrl);
    }
}
exports.VideosService = VideosService;
