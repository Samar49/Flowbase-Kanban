import Activity from '../models/Activity.js';
export async function logActivity(data){return Activity.create(data)}
