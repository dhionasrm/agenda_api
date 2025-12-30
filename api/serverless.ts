import { app } from "../src/app";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Esta é a função que a Vercel vai chamar quando chegar uma requisição
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await app.ready(); // Espera o Fastify carregar plugins
  app.server.emit('request', req, res); // Repassa a requisição da Vercel para o Fastify
}