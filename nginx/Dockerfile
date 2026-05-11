FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all frontend files
COPY ../ /usr/share/nginx/html/

EXPOSE 80
