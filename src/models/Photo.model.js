/**
 * Photo Model
 * Data access layer for photo library using MongoDB
 */

const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Photo title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Photo category is required'],
    enum: ['Food', 'Restaurant', 'Ambiance', 'Events', 'Other'],
    default: 'Food'
  },
  url: {
    type: String,
    required: [true, 'Photo URL is required'],
    trim: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes
photoSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });
photoSchema.index({ category: 1, isActive: 1 });

const Photo = mongoose.model('Photo', photoSchema);

// Helper functions
const getAllActive = async () => {
  return await Photo.find({ isActive: true })
    .sort({ isFeatured: -1, displayOrder: 1, createdAt: -1 });
};

const getAll = async (includeInactive = false) => {
  const query = includeInactive ? {} : { isActive: true };
  return await Photo.find(query)
    .sort({ isFeatured: -1, displayOrder: 1, createdAt: -1 });
};

const getById = async (id) => {
  return await Photo.findById(id);
};

const create = async (photoData) => {
  const photo = new Photo(photoData);
  await photo.save();
  return photo;
};

const update = async (id, photoData) => {
  return await Photo.findByIdAndUpdate(
    id,
    photoData,
    { new: true, runValidators: true }
  );
};

const deletePhoto = async (id) => {
  const result = await Photo.findByIdAndDelete(id);
  return !!result;
};

module.exports = {
  Photo,
  getAllActive,
  getAll,
  getById,
  create,
  update,
  delete: deletePhoto,
};
