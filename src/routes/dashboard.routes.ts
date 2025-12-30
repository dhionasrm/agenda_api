import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // Estatísticas gerais do dashboard (GET /stats) - Protegida por JWT
  app.get(
    "/stats",
    {
      schema: {
        summary: "Estatísticas do dashboard",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            consultasHoje: z.number(),
            pacientesAtivos: z.number(),
            aguardando: z.number(),
            concluidas: z.number(),
            consultasProximos7Dias: z.number(),
            dentistasAtivos: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      // Data de hoje (início e fim do dia)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const fimHoje = new Date(hoje);
      fimHoje.setHours(23, 59, 59, 999);

      // Data daqui a 7 dias
      const proximos7Dias = new Date(hoje);
      proximos7Dias.setDate(proximos7Dias.getDate() + 7);

      // Consultas de hoje
      const consultasHoje = await prisma.appointment.count({
        where: {
          dataHoraInicio: {
            gte: hoje,
            lte: fimHoje,
          },
          status: { notIn: ['cancelada'] },
        },
      });

      // Pacientes ativos
      const pacientesAtivos = await prisma.patient.count({
        where: { ativo: true },
      });

      // Consultas aguardando (agendadas ou confirmadas para hoje)
      const aguardando = await prisma.appointment.count({
        where: {
          dataHoraInicio: {
            gte: hoje,
            lte: fimHoje,
          },
          status: { in: ['agendada', 'confirmada'] },
        },
      });

      // Consultas concluídas hoje
      const concluidas = await prisma.appointment.count({
        where: {
          dataHoraInicio: {
            gte: hoje,
            lte: fimHoje,
          },
          status: 'concluida',
        },
      });

      // Consultas próximos 7 dias
      const consultasProximos7Dias = await prisma.appointment.count({
        where: {
          dataHoraInicio: {
            gte: hoje,
            lte: proximos7Dias,
          },
          status: { notIn: ['cancelada'] },
        },
      });

      // Dentistas ativos
      const dentistasAtivos = await prisma.dentist.count({
        where: { ativo: true },
      });

      return {
        consultasHoje,
        pacientesAtivos,
        aguardando,
        concluidas,
        consultasProximos7Dias,
        dentistasAtivos,
      };
    }
  );

  // Consultas recentes (GET /recent-appointments) - Protegida por JWT
  app.get(
    "/recent-appointments",
    {
      schema: {
        summary: "Consultas recentes/hoje",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          limit: z.coerce.number().default(10),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { limit } = request.query;

      // Data de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const fimHoje = new Date(hoje);
      fimHoje.setHours(23, 59, 59, 999);

      const appointments = await prisma.appointment.findMany({
        where: {
          dataHoraInicio: {
            gte: hoje,
            lte: fimHoje,
          },
        },
        include: {
          paciente: {
            select: { id: true, nome: true },
          },
          dentista: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { dataHoraInicio: 'asc' },
        take: limit,
      });

      return appointments;
    }
  );

  // Consultas por mês (para o calendário) (GET /monthly) - Protegida por JWT
  app.get(
    "/monthly",
    {
      schema: {
        summary: "Consultas por mês (para calendário)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          year: z.coerce.number(),
          month: z.coerce.number().min(1).max(12),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { year, month } = request.query;

      // Primeiro dia do mês
      const startDate = new Date(year, month - 1, 1);
      // Último dia do mês
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const appointments = await prisma.appointment.findMany({
        where: {
          dataHoraInicio: {
            gte: startDate,
            lte: endDate,
          },
          status: { notIn: ['cancelada'] },
        },
        select: {
          id: true,
          dataHoraInicio: true,
          status: true,
        },
      });

      // Agrupar por dia
      const appointmentsByDay: Record<number, number> = {};

      appointments.forEach((apt) => {
        const day = apt.dataHoraInicio.getDate();
        appointmentsByDay[day] = (appointmentsByDay[day] || 0) + 1;
      });

      return { year, month, appointmentsByDay };
    }
  );
};
