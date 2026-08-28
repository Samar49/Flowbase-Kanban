import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function auth(req,res,next){try{const token=req.cookies?.token||req.headers.authorization?.replace('Bearer ','');if(!token)return res.status(401).json({error:'Authentication required'});const payload=jwt.verify(token,process.env.JWT_SECRET);req.user=await User.findById(payload.id);if(!req.user)return res.status(401).json({error:'User not found'});next()}catch{res.status(401).json({error:'Invalid or expired token'})}}
