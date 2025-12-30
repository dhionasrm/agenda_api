import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Schema de criação de consulta
const createAppointmentSchema = z.object({
  pacienteId: z.number(),
  dentistaId: z.number(),
  dataHoraInicio: z.coerce.date(),
  dataHoraFim: z.coerce.date(),
  observacoes: z.string().optional(),
});

// Schema de atualização de consulta
const updateAppointmentSchema = z.object({
  pacienteId: z.number().optional(),
  dentistaId: z.number().optional(),
  dataHoraInicio: z.coerce.date().optional(),
  dataHoraFim: z.coerce.date().optional(),
  observacoes: z.string().optional(),
});

// Schema de atualização de status
const updateStatusSchema = z.object({
  status: z.enum(['agendada', 'confirmada', 'em_andamento', 'concluida', 'cancelada']),
});

export const appointmentRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // Criar consulta (POST /) - Protegida por JWT
  app.post(
    "/",
    {
      schema: {
        summary: "Criar nova consulta",
        tags: ["Consultas"],
        security: [{ bearerAuth: [] }],
        body: createAppointmentSchema,
        response: {
          201: z.object({ appointmentId: z.number() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { pacienteId, dentistaId, dataHoraInicio, dataHoraFim, observacoes } = request.body;

      // Verifica se paciente existe
      const patient = await prisma.patient.findUnique({ where: { id: pacienteId } });
      if (!patient || !patient.ativo) {
        return reply.status(404).send({ message: "Paciente não encontrado" });
      }

      // Verifica se dentista existe
      const dentist = await prisma.dentist.findUnique({ where: { id: dentistaId } });
      if (!dentist || !dentist.ativo) {
        return reply.status(404).send({ message: "Dentista não encontrado" });
      }

      // Verifica conflito de horário para o dentista
      const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
          dentistaId,
          status: { notIn: ['cancelada'] },
          OR: [
            {
              AND: [
                { dataHoraInicio: { lte: dataHoraInicio } },
                { dataHoraFim: { gt: dataHoraInicio } },
              ],
            },
            {
              AND: [
                { dataHoraInicio: { lt: dataHoraFim } },
                { dataHoraFim: { gte: dataHoraFim } },
              ],
            },
            {
              AND: [
                { dataHoraInicio: { gte: dataHoraInicio } },
                { dataHoraFim: { lte: dataHoraFim } },
              ],
            },
          ],
        },
      });

      if (conflictingAppointment) {
        return reply.status(400).send({ message: "Dentista já possui consulta neste horário" });
      }

      const appointment = await prisma.appointment.create({
        data: {
          pacienteId,
          dentistaId,
          dataHoraInicio,
          dataHoraFim,
          observacoes,
        },
      });

      // Cria log de status inicial
      await prisma.statusLog.create({
        data: {
          consultaId: appointment.id,
          status: 'agendada',
          usuarioId: (request.user as any).userId || 1, // Pega do token JWT
        },
      });

      return reply.status(201).send({ appointmentId: appointment.id });
    }
  );

  // Listar consultas (GET /) - Protegida por JWT
  app.get(
    "/",
    {
      schema: {
        summary: "Listar consultas",
        tags: ["Consultas"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          pacienteId: z.coerce.number().optional(),
          dentistaId: z.coerce.number().optional(),
          status: z.string().optional(),
          dataInicio: z.coerce.date().optional(),
          dataFim: z.coerce.date().optional(),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { pacienteId, dentistaId, status, dataInicio, dataFim } = request.query;

      const where: any = {};

      if (pacienteId) where.pacienteId = pacienteId;
      if (dentistaId) where.dentistaId = dentistaId;
      if (status) where.status = status;
      if (dataInicio && dataFim) {
        where.dataHoraInicio = { gte: dataInicio, lte: dataFim };
      }

      const appointments = await prisma.appointment.findMany({
        where,
        include: {
          paciente: {
            select: { id: true, nome: true, telefone: true, email: true },
          },
          dentista: {
            select: { id: true, nome: true, cro: true, especialidade: true },
          },
        },
        orderBy: { dataHoraInicio: 'asc' },
      });

      return appointments;
    }
  );

  // Buscar consulta por ID (GET /:id) - Protegida por JWT
  app.get(
    "/:id",
    {
      schema: {
        summary: "Buscar consulta por ID",
        tags: ["Consultas"],
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

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          paciente: true,
          dentista: true,
          logs: {
            include: {
              usuario: {
                select: { id: true, nome: true },
              },
            },
            orderBy: { dataAlteracao: 'desc' },
          },
        },
      });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      return appointment;
    }
  );

  // Atualizar consulta (PUT /:id) - Protegida por JWT
  app.put(
    "/:id",
    {
      schema: {
        summary: "Atualizar consulta",
        tags: ["Consultas"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
        body: updateAppointmentSchema,
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

      const appointment = await prisma.appointment.findUnique({ where: { id } });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      // Verifica conflito de horário se está mudando horário/dentista
      if (data.dataHoraInicio || data.dataHoraFim || data.dentistaId) {
        const dentistaId = data.dentistaId || appointment.dentistaId;
        const dataHoraInicio = data.dataHoraInicio || appointment.dataHoraInicio;
        const dataHoraFim = data.dataHoraFim || appointment.dataHoraFim;

        const conflictingAppointment = await prisma.appointment.findFirst({
          where: {
            id: { not: id },
            dentistaId,
            status: { notIn: ['cancelada'] },
            OR: [
              {
                AND: [
                  { dataHoraInicio: { lte: dataHoraInicio } },
                  { dataHoraFim: { gt: dataHoraInicio } },
                ],
              },
              {
                AND: [
                  { dataHoraInicio: { lt: dataHoraFim } },
                  { dataHoraFim: { gte: dataHoraFim } },
                ],
              },
              {
                AND: [
                  { dataHoraInicio: { gte: dataHoraInicio } },
                  { dataHoraFim: { lte: dataHoraFim } },
                ],
              },
            ],
          },
        });

        if (conflictingAppointment) {
          return reply.status(400).send({ message: "Dentista já possui consulta neste horário" });
        }
      }

      const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data,
      });

      return updatedAppointment;
    }
  );

  // Atualizar status da consulta (PATCH /:id/status) - Protegida por JWT
  app.patch(
    "/:id/status",
    {
      schema: {
        summary: "Atualizar status da consulta",
        tags: ["Consultas"],
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.coerce.number(),
        }),
        body: updateStatusSchema,
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params;
      const { status } = request.body;

      const appointment = await prisma.appointment.findUnique({ where: { id } });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      // Atualiza o status
      const updatedAppointment = await prisma.appointment.update({
        where: { id },
        data: { status },
      });

      // Cria log de alteração de status
      await prisma.statusLog.create({
        data: {
          consultaId: id,
          status,
          usuarioId: (request.user as any).userId || 1,
        },
      });

      return updatedAppointment;
    }
  );

  // Deletar consulta (DELETE /:id) - Protegida por JWT
  app.delete(
    "/:id",
    {
      schema: {
        summary: "Cancelar consulta",
        tags: ["Consultas"],
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

      const appointment = await prisma.appointment.findUnique({ where: { id } });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      // Marca como cancelada ao invés de deletar
      await prisma.appointment.update({
        where: { id },
        data: { status: 'cancelada' },
      });

      // Cria log de cancelamento
      await prisma.statusLog.create({
        data: {
          consultaId: id,
          status: 'cancelada',
          usuarioId: (request.user as any).userId || 1,
        },
      });

      return { message: "Consulta cancelada com sucesso" };
    }
  );
};
