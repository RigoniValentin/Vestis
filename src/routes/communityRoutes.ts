import { Router } from "express";
import { optionalVerifyToken, verifyToken } from "@middlewares/auth";
import {
  uploadAvatar,
  uploadCommunityImage,
  uploadLensContentImage,
  uploadMarketImage,
} from "@middlewares/uploadCommunity";
import {
  addComment,
  adminCommunitySummary,
  adminListMarketEntries,
  createMarketEntry,
  createPost,
  deleteComment,
  deleteMarketEntry,
  deletePost,
  getMyCommunityProfile,
  listMarketEntries,
  listNotifications,
  listPosts,
  markNotificationsRead,
  reactToPost,
  removeOwnAvatar,
  toggleHidePost,
  togglePinPost,
  toggleSavePost,
  updateMarketEntry,
  uploadOwnAvatar,
} from "@controllers/communityController";
import {
  adminListLensContent,
  createLensContent,
  deleteLensContent,
  listLensContent,
  toggleLensContentActive,
  toggleLensContentPin,
  updateLensContent,
} from "@controllers/lensContentController";

const router = Router();

/* Posts (read open, write requires auth) */
router.get("/posts", optionalVerifyToken, listPosts);
router.post("/posts", verifyToken, uploadCommunityImage, createPost);
router.delete("/posts/:id", verifyToken, deletePost);
router.post("/posts/:id/react", verifyToken, reactToPost);
router.post("/posts/:id/save", verifyToken, toggleSavePost);
router.post("/posts/:id/comments", verifyToken, addComment);
router.delete("/posts/:id/comments/:commentId", verifyToken, deleteComment);
router.post("/posts/:id/pin", verifyToken, togglePinPost);
router.post("/posts/:id/hide", verifyToken, toggleHidePost);

/* Market */
router.get("/market", listMarketEntries);
router.get("/market/admin", verifyToken, adminListMarketEntries);
router.post("/market", verifyToken, uploadMarketImage, createMarketEntry);
router.put("/market/:id", verifyToken, uploadMarketImage, updateMarketEntry);
router.delete("/market/:id", verifyToken, deleteMarketEntry);

/* Notifications */
router.get("/notifications", verifyToken, listNotifications);
router.post("/notifications/read", verifyToken, markNotificationsRead);

/* Profile */
router.get("/profile", verifyToken, getMyCommunityProfile);
router.post("/profile/avatar", verifyToken, uploadAvatar, uploadOwnAvatar);
router.delete("/profile/avatar", verifyToken, removeOwnAvatar);

/* Lens content (Liz publishes standalone content for each lens) */
router.get("/lens-content", optionalVerifyToken, listLensContent);
router.get("/lens-content/admin", verifyToken, adminListLensContent);
router.post(
  "/lens-content",
  verifyToken,
  uploadLensContentImage,
  createLensContent
);
router.put(
  "/lens-content/:id",
  verifyToken,
  uploadLensContentImage,
  updateLensContent
);
router.delete("/lens-content/:id", verifyToken, deleteLensContent);
router.post("/lens-content/:id/pin", verifyToken, toggleLensContentPin);
router.post("/lens-content/:id/active", verifyToken, toggleLensContentActive);

/* Admin summary */
router.get("/admin/summary", verifyToken, adminCommunitySummary);

export default router;
