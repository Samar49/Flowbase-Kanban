import {Router} from 'express';import {analytics} from '../controllers/analytics.js';const r=Router();r.get('/projects/:projectId/analytics',analytics);export default r;
