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
  // Campos adicionais — seção 6.2.3 do PDF
  procedimento: z.string().max(100).optional(),
  convenio: z.string().max(100).optional(),
  valorPrevisto: z.number().positive().optional(),
  origemAgendamento: z.enum(['recepcao', 'portal_paciente', 'whatsapp', 'telefone', 'outro']).optional(),
});

// Schema de atualização de consulta
const updateAppointmentSchema = z.object({
  pacienteId: z.number().optional(),
  dentistaId: z.number().optional(),
  dataHoraInicio: z.coerce.date().optional(),
  dataHoraFim: z.coerce.date().optional(),
  observacoes: z.string().optional(),
  procedimento: z.string().max(100).optional(),
  convenio: z.string().max(100).optional(),
  valorPrevisto: z.number().positive().optional(),
  origemAgendamento: z.enum(['recepcao', 'portal_paciente', 'whatsapp', 'telefone', 'outro']).optional(),
});

// Schema de atualização de status
// Fluxo completo (PDF seções 6.2.2 e 6.2.7):
//   agendada → aguardando (check-in) → em_andamento → concluida
//   Saídas alternativas: confirmada, cancelada, falta (no-show), reagendada
const updateStatusSchema = z.object({
  status: z.enum([
    'agendada',      // status inicial
    'confirmada',    // paciente confirmou presença
    'aguardando',    // check-in feito, aguardando na recepção (seção 6.2.7)
    'em_andamento',  // profissional iniciou atendimento
    'concluida',     // atendimento finalizado
    'cancelada',     // cancelado
    'falta',         // não compareceu — no-show (seção 8.7)
    'reagendada',    // remarcada (seção 8.6)
  ]),
});

const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
  pacienteId: z.coerce.number().optional(),
  dentistaId: z.coerce.number().optional(),
  status: z.string().optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
});

const appointmentItemSchema = z.object({
  id: z.number(),
  pacienteId: z.number(),
  dentistaId: z.number(),
  dataHoraInicio: z.date(),
  dataHoraFim: z.date(),
  status: z.string(),
  observacoes: z.string().nullable(),
  procedimento: z.string().nullable(),
  convenio: z.string().nullable(),
  valorPrevisto: z.number().nullable(),
  origemAgendamento: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  paciente: z.object({
    id: z.number(),
    nome: z.string(),
    telefone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  dentista: z.object({
    id: z.number(),
    nome: z.string(),
    cro: z.string(),
    especialidade: z.string().nullable(),
  }),
});

const paginatedAppointmentsSchema = z.object({
  items: z.array(appointmentItemSchema),
  total: z.number(),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
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
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { pacienteId, dentistaId, dataHoraInicio, dataHoraFim, observacoes, procedimento, convenio, valorPrevisto, origemAgendamento } = request.body;

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
          procedimento,
          convenio,
          valorPrevisto,
          origemAgendamento,
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
        querystring: listAppointmentsQuerySchema,
        response: {
          200: paginatedAppointmentsSchema,
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

      const { page, size, pacienteId, dentistaId, status, dataInicio, dataFim } = request.query;
      const skip = (page - 1) * size;

      const where: any = {};

      if (pacienteId) where.pacienteId = pacienteId;
      if (dentistaId) where.dentistaId = dentistaId;
      if (status) where.status = status;
      if (dataInicio) {
        // Normaliza para início do dia
        const inicio = new Date(dataInicio);
        inicio.setHours(0, 0, 0, 0);
        // Se não foi informado dataFim, usa o fim do mesmo dia de dataInicio
        const fim = dataFim ? new Date(dataFim) : new Date(dataInicio);
        if (!dataFim) fim.setHours(23, 59, 59, 999);
        where.dataHoraInicio = { gte: inicio, lte: fim };
      }

      const [items, total] = await Promise.all([
        prisma.appointment.findMany({
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
          skip,
          take: size,
        }),
        prisma.appointment.count({ where }),
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
