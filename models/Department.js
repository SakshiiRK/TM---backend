const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  hod: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});
module.exports = mongoose.model('Department', DepartmentSchema);