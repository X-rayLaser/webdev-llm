FROM node

COPY . /home/node/nextjs_app

WORKDIR /home/node/nextjs_app

RUN chown -R node: .

USER node

RUN npm install --ignore-scripts

RUN npx next build

CMD ["npm", "run", "dev"]
