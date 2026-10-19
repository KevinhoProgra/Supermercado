import { Router } from 'express';
import { getApiHealth, getDbHealth } from '../controllers/healthController.js';

const router = Router();

router.get('/health', getApiHealth);
router.get('/health/db', getDbHealth);

export default router;
