import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const registerSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha precisa de 6 caracteres no mínimo"),
  perfil: z.enum(['admin', 'atendente', 'dentista']),
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string(),
});

// Schema de erro padrão (para reutilizar)
const errorSchema = z.object({
  message: z.string(),
});

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // --- ROTA DE REGISTRO ---
  app.post(
    "/register",
    {
      schema: {
        summary: "Criar um novo usuário",
        tags: ["Autenticação"],
        body: registerSchema,
        response: {
          201: z.object({
            message: z.string(),
            userId: z.number(),
          }),
          // AQUI ESTAVA FALTANDO: Dizemos que o erro 400 retorna uma mensagem
          400: errorSchema, 
        },
      },
    },
    async (request, reply) => {
      const { nome, email, senha, perfil } = request.body;

      const userExists = await prisma.user.findUnique({
        where: { email },
      });

      if (userExists) {
        // Agora o TypeScript aceita o status 400 porque definimos no schema acima
        return reply.status(400).send({ message: "E-mail já está em uso." });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const user = await prisma.user.create({
        data: {
          nome,
          email,
          senhaHash,
          perfil,
          ativo: true
        },
      });

      return reply.status(201).send({ 
        message: "Usuário criado com sucesso!",
        userId: user.id 
      });
    }
  );

  // --- ROTA DE LOGIN ---
  app.post(
    "/login",
    {
      schema: {
        summary: "Fazer login e receber Token",
        tags: ["Autenticação"],
        body: loginSchema,
        response: {
          200: z.object({
            token: z.string(),
            nome: z.string(),
            perfil: z.string(),
          }),
          // AQUI TAMBÉM: Adicionamos o erro 400
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, senha } = request.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.ativo) {
        return reply.status(400).send({ message: "Credenciais inválidas." });
      }

      const isPasswordValid = await bcrypt.compare(senha, user.senhaHash);

      if (!isPasswordValid) {
        return reply.status(400).send({ message: "Credenciais inválidas." });
      }

      const token = app.jwt.sign(
        {
          nome: user.nome,
          perfil: user.perfil,
        },
        {
          sub: user.id.toString(),
          expiresIn: "7d",
        }
      );

      return reply.status(200).send({
        token,
        nome: user.nome,
        perfil: user.perfil,
      });
    }
  );
};