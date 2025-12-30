import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Definição dos Schemas (Inputs)
const createPatientSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.coerce.date().optional(), // "coerce" transforma string "2023-01-01" em Date
  observacoes: z.string().optional(),
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
      const { nome, email, telefone, dataNascimento, observacoes } = request.body;

      const patient = await prisma.patient.create({
        data: {
          nome,
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
        security: [{ bearerAuth: [] }], // Indica no Swagger que precisa de token
      },
    },
    async (request, reply) => {
      // Verifica token JWT
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const patients = await prisma.patient.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' }
      });

      return patients;
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