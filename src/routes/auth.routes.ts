import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const registerSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  // Regras de senha conforme copilot-instructions.md §9
  senha: z.string()
    .min(8, "A senha precisa de 8 caracteres no mínimo")
    .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "A senha deve conter ao menos um número")
    .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial"),
  // 5 perfis definidos no PDF §3
  perfil: z.enum(['admin', 'atendente', 'dentista', 'gestor', 'paciente']),
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string(),
});

// Schema de erro padrão (para reutilizar)
const errorSchema = z.object({
  message: z.string(),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

// senhaHash é explicitamente omitido para nunca vazar na resposta
const userItemSchema = z.object({
  id: z.number(),
  nome: z.string(),
  email: z.string(),
  perfil: z.string(),
  ativo: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const paginatedUsersSchema = z.object({
  items: z.array(userItemSchema),
  total: z.number(),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
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

  // --- ROTA DE LISTAGEM DE USUÁRIOS ---
  app.get(
    "/users",
    {
      schema: {
        summary: "Listar usuários",
        tags: ["Autenticação"],
        security: [{ bearerAuth: [] }],
        querystring: listUsersQuerySchema,
        response: {
          200: paginatedUsersSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { page, size } = request.query;
      const skip = (page - 1) * size;

      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          skip,
          take: size,
          select: {
            id: true,
            nome: true,
            email: true,
            perfil: true,
            ativo: true,
            createdAt: true,
            updatedAt: true,
            // senhaHash: omitido intencionalmente
          },
        }),
        prisma.user.count({
          where: { ativo: true },
        }),
      ]);

      return {
        items,
        total,
        page,
        size,
        pages: Math.ceil(total / size),
      };
    }
  );
};