import { Router } from 'express';
import { getCurrentUser, login, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { checkLoginThrottle } from '../middleware/loginThrottle.js';

const router = Router();

router.post('/login', checkLoginThrottle, login);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

export default router;
