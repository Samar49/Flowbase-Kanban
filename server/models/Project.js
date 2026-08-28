import mongoose from 'mongoose';
const columnSchema=new mongoose.Schema({name:{type:String,required:true},position:{type:Number,default:0},color:{type:String,default:'#0A84FF'},wipLimit:{type:Number,default:0}},{_id:true});
const projectSchema=new mongoose.Schema({name:{type:String,required:true},description:String,workspace:{type:mongoose.Schema.Types.ObjectId,ref:'Workspace',required:true},owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},members:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],columns:[columnSchema]},{timestamps:true});
export default mongoose.model('Project',projectSchema);
