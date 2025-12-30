import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Schema de criação de dentista
const createDentistSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cro: z.string().min(3, "CRO é obrigatório"),
  especialidade: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional(),
});

// Schema de atualização de dentista
const updateDentistSchema = z.object({
  nome: z.string().min(3).optional(),
  cro: z.string().min(3).optional(),
  especialidade: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional(),
});

export const dentistRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // Criar dentista (POST /) - Protegida por JWT
  app.post(
    "/",
    {
      schema: {
        summary: "Criar novo dentista",
        tags: ["Dentistas"],
        security: [{ bearerAuth: [] }],
        body: createDentistSchema,
        response: {
          201: z.object({ dentistId: z.number() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { nome, cro, especialidade, telefone, email } = request.body;

      // Verifica se CRO já existe
      const existingDentist = await prisma.dentist.findUnique({
        where: { cro },
      });

      if (existingDentist) {
        return reply.status(400).send({ message: "CRO já cadastrado" });
      }

      const dentist = await prisma.dentist.create({
        data: {
          nome,
          cro,
          especialidade,
          telefone,
          email,
        },
      });

      return reply.status(201).send({ dentistId: dentist.id });
    }
  );

  // Listar dentistas (GET /) - Protegida por JWT
  app.get(
    "/",
    {
      schema: {
        summary: "Listar dentistas",
        tags: ["Dentistas"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const dentists = await prisma.dentist.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
      });

      return dentists;
    }
  );

  // Buscar dentista por ID (GET /:id) - Protegida por JWT
  app.get(
    "/:id",
    {
      schema: {
        summary: "Buscar dentista por ID",
        tags: ["Dentistas"],
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

      const dentist = await prisma.dentist.findUnique({
        where: { id },
      });

      if (!dentist || !dentist.ativo) {
        return reply.status(404).send({ message: "Dentista não encontrado" });
      }

      return dentist;
    }
  );

  // Atualizar dentista (PUT /:id) - Protegida por JWT
  app.put(
    "/:id",
    {
      schema: {
        summary: "Atualizar dentista",
        tags: ["Dentistas"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
        body: updateDentistSchema,
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

      const dentist = await prisma.dentist.findUnique({ where: { id } });

      if (!dentist || !dentist.ativo) {
        return reply.status(404).send({ message: "Dentista não encontrado" });
      }

      // Se está atualizando o CRO, verifica se já não existe outro com o mesmo
      if (data.cro && data.cro !== dentist.cro) {
        const existingDentist = await prisma.dentist.findUnique({
          where: { cro: data.cro },
        });

        if (existingDentist) {
          return reply.status(400).send({ message: "CRO já cadastrado" });
        }
      }

      const updatedDentist = await prisma.dentist.update({
        where: { id },
        data,
      });

      return updatedDentist;
    }
  );

  // Deletar dentista (DELETE /:id) - Soft delete - Protegida por JWT
  app.delete(
    "/:id",
    {
      schema: {
        summary: "Deletar dentista (soft delete)",
        tags: ["Dentistas"],
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

      const dentist = await prisma.dentist.findUnique({ where: { id } });

      if (!dentist) {
        return reply.status(404).send({ message: "Dentista não encontrado" });
      }

      // Soft delete: apenas marca como inativo
      await prisma.dentist.update({
        where: { id },
        data: { ativo: false },
      });

      return { message: "Dentista removido com sucesso" };
    }
  );
};
