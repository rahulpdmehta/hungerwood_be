/**
 * Request Validation Middleware using Joi
 */

const Joi = require('joi');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Generic validation middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return errorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'Validation Error',
        errors
      );
    }
    
    next();
  };
};

/**
 * Validation Schemas
 */

// Auth schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid 10-digit Indian phone number',
      'any.required': 'Phone number is required'
    })
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otp: Joi.string()
    .length(6)
    .required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'any.required': 'OTP is required'
    })
});

// Order schemas
const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        menuItem: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        addons: Joi.array().items(
          Joi.object({
            name: Joi.string(),
            price: Joi.number()
          })
        )
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one item is required'
    }),
  
  orderType: Joi.string()
    .valid('DINE_IN', 'TAKEAWAY', 'DELIVERY')
    .required(),
  
  paymentMethod: Joi.string()
    .valid('UPI', 'CASH', 'CARD')
    .required(),
  
  deliveryAddress: Joi.when('orderType', {
    is: 'DELIVERY',
    then: Joi.object({
      street: Joi.string().required(),
      landmark: Joi.string(),
      city: Joi.string().required(),
      pincode: Joi.string().pattern(/^\d{6}$/).required()
    }).required(),
    otherwise: Joi.optional()
  }),
  
  instructions: Joi.string().max(500).allow('')
});

// Category schema (Admin)
const categorySchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Category name must be at least 2 characters',
      'any.required': 'Category name is required'
    }),
  description: Joi.string()
    .max(200)
    .allow(''),
  imageUrl: Joi.string()
    .uri()
    .allow(''),
  isActive: Joi.boolean()
});

// Menu item schema (Admin)
const menuItemSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().required(),
  image: Joi.string().uri().required(),
  isVeg: Joi.boolean(),
  isAvailable: Joi.boolean(),
  tags: Joi.object({
    isBestseller: Joi.boolean(),
    isRecommended: Joi.boolean(),
    isSpecial: Joi.boolean()
  }),
  spiceLevel: Joi.string().valid('None', 'Low', 'Medium', 'High', 'Extra Hot'),
  prepTime: Joi.number().min(0),
  addons: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      price: Joi.number().min(0).required()
    })
  )
});

// Order status update schema (Admin)
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('RECEIVED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED')
    .required()
});

module.exports = {
  validate,
  sendOTPSchema,
  verifyOTPSchema,
  createOrderSchema,
  categorySchema,
  menuItemSchema,
  updateOrderStatusSchema
};
