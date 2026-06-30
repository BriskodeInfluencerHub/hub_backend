import mongoose from 'mongoose';

const coordinatorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedRegion: { type: String, default: '' },
  phone: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Coordinator = mongoose.model('Coordinator', coordinatorSchema);
export default Coordinator;
