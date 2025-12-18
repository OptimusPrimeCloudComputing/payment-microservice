# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Copy database schema
COPY db_schema.sql ./

# Expose port (Cloud Run will inject PORT env variable)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

