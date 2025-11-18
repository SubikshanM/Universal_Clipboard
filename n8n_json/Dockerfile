FROM n8nio/n8n:latest

# Set environment for production
ENV NODE_ENV=production
ENV N8N_PORT=5678

# Use root to copy files then switch back to node user
USER root

# Create the .n8n directory if it doesn't exist and copy workflow file
RUN mkdir -p /home/node/.n8n
COPY otp-workflow.json /home/node/.n8n/otp-workflow.json
RUN chown -R node:node /home/node/.n8n || true

# Switch back to the unprivileged user that the official image expects
USER node

# Expose the n8n port
EXPOSE 5678

# CRITICAL FIX: Replace the default CMD with an explicit ENTRYPOINT.
# This forces the DB_TYPE to be set to postgresdb before running 'n8n start'.
# This should stop the connection attempt to the local address (::1:5432).
ENTRYPOINT ["/bin/sh", "-c", "export DB_TYPE=postgresdb && n8n start"]