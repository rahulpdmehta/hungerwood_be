/**
 * Entity Transformation Utilities
 * Transforms MongoDB documents to use _id as id field value
 */

/**
 * Transform entity: Set id to _id value (MongoDB ObjectId as string)
 * This ensures consistency where id field always contains the _id value
 * @param {Object} entity - Mongoose document or plain object
 * @returns {Object|null} - Transformed entity with id = _id.toString()
 */
const transformEntity = (entity) => {
  if (!entity) return null;
  const entityObj = entity.toObject ? entity.toObject() : { ...entity };
  
  // Set id to _id value (MongoDB ObjectId as string) - override any existing string id field
  if (entityObj._id) {
    entityObj.id = entityObj._id.toString();
  }
  
  return entityObj;
};

/**
 * Transform array of entities
 * @param {Array} entities - Array of Mongoose documents or plain objects
 * @returns {Array} - Array of transformed entities
 */
const transformEntities = (entities) => {
  if (!Array.isArray(entities)) return entities;
  return entities.map(transformEntity);
};

/**
 * Transform entity with nested objects (e.g., order with items, user with addresses)
 * Recursively transforms nested entities that have _id fields
 * @param {Object} entity - Entity with potential nested objects
 * @param {Array} nestedFields - Array of field names that contain nested entities
 * @returns {Object|null} - Transformed entity with nested objects also transformed
 */
const transformEntityWithNested = (entity, nestedFields = []) => {
  if (!entity) return null;
  const transformed = transformEntity(entity);
  
  // Transform nested fields
  nestedFields.forEach(field => {
    if (transformed[field]) {
      if (Array.isArray(transformed[field])) {
        transformed[field] = transformed[field].map(item => {
          if (item && item._id) {
            return transformEntity(item);
          }
          return item;
        });
      } else if (transformed[field]._id) {
        transformed[field] = transformEntity(transformed[field]);
      }
    }
  });
  
  return transformed;
};

module.exports = {
  transformEntity,
  transformEntities,
  transformEntityWithNested
};
