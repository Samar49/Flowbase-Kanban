import mongoose from 'mongoose';
const commentSchema=new mongoose.Schema({task:{type:mongoose.Schema.Types.ObjectId,ref:'Task',required:true},user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},body:{type:String,required:true,trim:true}},{timestamps:true});
export default mongoose.model('Comment',commentSchema);
