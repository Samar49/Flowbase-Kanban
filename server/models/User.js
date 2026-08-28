import mongoose from 'mongoose';
const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true},username:{type:String,required:true,unique:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true},avatar:String},{timestamps:true});
export default mongoose.model('User',userSchema);
