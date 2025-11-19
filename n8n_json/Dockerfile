FROM n8nio/n8n:latest

# Set environment for production
ENV NODE_ENV=production
ENV N8N_PORT=5678

# Use root to copy files then switch back to node user
USER root

# Create the .n8n directory if it doesn't exist and copy workflow file so n8n can load it
RUN mkdir -p /home/node/.n8n
COPY otp-workflow.json /home/node/.n8n/otp-workflow.json
RUN chown -R node:node /home/node/.n8n || true

# Switch back to the unprivileged user that the official image expects
USER node

# Expose the n8n port
EXPOSE 5678

# CRITICAL FIX: This ENTRYPOINT forces the database connection.
ENTRYPOINT ["/bin/sh", "-c", "export DB_TYPE=postgresdb && export DB_POSTGRES_CONNECTION_URL=\"postgresql://neondb_owner:npg_YLQx5u7dsebV@ep-frosty-hill-ad1enk4j-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require\" && n8n start"]