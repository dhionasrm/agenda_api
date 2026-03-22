import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Definição dos Schemas (Inputs)
const createPatientSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "CPF inválido").optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.coerce.date().optional(), // "coerce" transforma string "2023-01-01" em Date
  observacoes: z.string().optional(),
});

const listPatientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

const patientItemSchema = z.object({
  id: z.number(),
  nome: z.string(),
  cpf: z.string().nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  dataNascimento: z.date().nullable(),
  observacoes: z.string().nullable(),
  ativo: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const paginatedPatientsSchema = z.object({
  items: z.array(patientItemSchema),
  total: z.number(),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
});

export const patientRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // Rota de Criação (POST)
  app.post(
    "/",
    {
      schema: {
        summary: "Criar novo paciente",
        tags: ["Pacientes"],
        body: createPatientSchema, // Valida o corpo da requisição
        response: {
          201: z.object({ patientId: z.number() }), // Resposta tipada
        },
      },
    },
    async (request, reply) => {
      const { nome, cpf, email, telefone, dataNascimento, observacoes } = request.body;

      const patient = await prisma.patient.create({
        data: {
          nome,
          cpf,
          email,
          telefone,
          dataNascimento,
          observacoes,
        },
      });

      return reply.status(201).send({ patientId: patient.id });
    }
  );

  // Rota de Listagem (GET) - Protegida por JWT
  app.get(
    "/",
    {
      schema: {
        summary: "Listar pacientes",
        tags: ["Pacientes"],
        security: [{ bearerAuth: [] }],
        querystring: listPatientsQuerySchema,
        response: {
          200: paginatedPatientsSchema,
          401: z.object({ message: z.string() }),
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
        prisma.patient.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          skip,
          take: size,
        }),
        prisma.patient.count({
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

  // Rota de Busca por ID (GET /:id) - Protegida por JWT
  app.get(
    "/:id",
    {
      schema: {
        summary: "Buscar paciente por ID",
        tags: ["Pacientes"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params;

      const patient = await prisma.patient.findUnique({
        where: { id },
      });

      if (!patient || !patient.ativo) {
        return reply.status(404).send({ message: "Paciente não encontrado" });
      }

      return patient;
    }
  );

  // Rota de Atualização (PUT /:id) - Protegida por JWT
  app.put(
    "/:id",
    {
      schema: {
        summary: "Atualizar paciente",
        tags: ["Pacientes"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
        body: z.object({
          nome: z.string().min(3).optional(),
          cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "CPF inválido").optional(),
          email: z.string().email().optional(),
          telefone: z.string().optional(),
          dataNascimento: z.coerce.date().optional(),
          observacoes: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params;
      const data = request.body;

      const patient = await prisma.patient.findUnique({ where: { id } });

      if (!patient || !patient.ativo) {
        return reply.status(404).send({ message: "Paciente não encontrado" });
      }

      const updatedPatient = await prisma.patient.update({
        where: { id },
        data,
      });

      return updatedPatient;
    }
  );

  // Rota de Exclusão (DELETE /:id) - Soft delete - Protegida por JWT
  app.delete(
    "/:id",
    {
      schema: {
        summary: "Deletar paciente (soft delete)",
        tags: ["Pacientes"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params;

      const patient = await prisma.patient.findUnique({ where: { id } });

      if (!patient) {
        return reply.status(404).send({ message: "Paciente não encontrado" });
      }

      // Soft delete: apenas marca como inativo
      await prisma.patient.update({
        where: { id },
        data: { ativo: false },
      });

      return { message: "Paciente removido com sucesso" };
    }
  );
};