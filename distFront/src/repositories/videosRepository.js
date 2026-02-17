"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoRepository = void 0;
const Videos_1 = require("@models/Videos");
class VideoRepository {
    async create(video) {
        const newVideo = new Videos_1.VideoModel(video);
        return await newVideo.save();
    }
    async find(query) {
        return await Videos_1.VideoModel.find(query || {}).exec();
    }
    async findOne(query) {
        return await Videos_1.VideoModel.findOne(query).exec();
    }
    async findById(id) {
        return await Videos_1.VideoModel.findById(id).exec();
    }
    async update(id, data) {
        return await Videos_1.VideoModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async updateByCombo(query, newUrl) {
        return await Videos_1.VideoModel.findOneAndUpdate(query, { url: newUrl }, { new: true }).exec();
    }
    async delete(id) {
        const deleted = await Videos_1.VideoModel.findByIdAndDelete(id).exec();
        return deleted !== null;
    }
    async deleteByUrl(url) {
        const deleted = await Videos_1.VideoModel.findOneAndDelete({ url }).exec();
        return deleted !== null;
    }
}
exports.VideoRepository = VideoRepository;
