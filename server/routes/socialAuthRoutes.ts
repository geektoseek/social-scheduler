import express from "express";
import { generateAuthUrl, syncAccounts } from "../controllers/SocialAuthControler.js";
import { protect } from "../middlewares/authMiddelwares.js";

const socialAuthRouter = express.Router();

socialAuthRouter.get('/:platform/url', protect, generateAuthUrl)
socialAuthRouter.get('/sync', protect, syncAccounts)

export default socialAuthRouter;