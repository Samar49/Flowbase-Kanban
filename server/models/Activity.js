import mongoose from 'mongoose';
const activitySchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User'},project:{type:mongoose.Schema.Types.ObjectId,ref:'Project'},task:{type:mongoose.Schema.Types.ObjectId,ref:'Task'},action:{type:String,required:true},metadata:{type:Object,default:{}},timestamp:{type:Date,default:Date.now}},{timestamps:true});
activitySchema.index({project:1,timestamp:-1});
export default mongoose.model('Activity',activitySchema);
