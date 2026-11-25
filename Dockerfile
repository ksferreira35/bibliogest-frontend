FROM node:24-alpine AS build
WORKDIR /workspace
COPY package*.json ./
RUN CYPRESS_INSTALL_BINARY=0 npm ci
COPY . .
RUN npm run lint && npm test && npm run build

FROM nginxinc/nginx-unprivileged:1.28.0-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
