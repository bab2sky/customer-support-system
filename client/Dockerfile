# build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# production stage
FROM nginx:alpine
# 커스텀 Nginx 설정 복사
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# React 빌드 결과 복사
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
