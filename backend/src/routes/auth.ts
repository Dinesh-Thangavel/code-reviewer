import { Router } from 'express';
import { signup, login, getCurrentUser, updateProfile } from '../controllers/auth';

export const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', getCurrentUser);
router.put('/profile', updateProfile);
