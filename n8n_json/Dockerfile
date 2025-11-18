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

# The n8n default CMD from the base image will be used (starts n8n server)
