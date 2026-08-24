import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { uploadSocialLinkImage } from "@middlewares/uploadSocialLink";
import { SocialLinkController } from "@controllers/socialLinkController";

const router = Router();

// Público: redes sociales activas (las consume el footer)
router.get("/", SocialLinkController.getActive);

// Admin
router.get("/admin", verifyToken, SocialLinkController.getAll);
router.post(
  "/",
  verifyToken,
  uploadSocialLinkImage,
  SocialLinkController.create
);
router.put(
  "/:id",
  verifyToken,
  uploadSocialLinkImage,
  SocialLinkController.update
);
router.patch("/:id/toggle", verifyToken, SocialLinkController.toggle);
router.delete("/:id", verifyToken, SocialLinkController.remove);

export default router;
