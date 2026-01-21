import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { whatsappService } from "../services/whatsapp.service";

const prisma = new PrismaClient();

// Schema para enviar mensagem customizada
const sendMessageSchema = z.object({
  phoneNumber: z.string().min(10, "Telefone inválido"),
  message: z.string().min(1, "Mensagem não pode estar vazia"),
});

// Schema para lembrete de consulta
const appointmentReminderSchema = z.object({
  appointmentId: z.number(),
});

export const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  
  // Enviar mensagem WhatsApp customizada (POST /send) - Protegida por JWT
  app.post(
    "/send",
    {
      schema: {
        summary: "Enviar mensagem WhatsApp customizada",
        tags: ["Notificações"],
        security: [{ bearerAuth: [] }],
        body: sendMessageSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            message: z.string(),
          }),
          401: z.object({ message: z.string() }),
          500: z.object({ message: z.string(), error: z.any().optional() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { phoneNumber, message } = request.body;

      // Formata o número de telefone
      const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

      // Envia a mensagem
      const result = await whatsappService.sendTextMessage({
        to: formattedPhone,
        message,
      });

      if (!result.success) {
        return reply.status(500).send({
          message: "Erro ao enviar mensagem WhatsApp",
          error: result.error,
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        message: "Mensagem enviada com sucesso",
      };
    }
  );

  // Enviar lembrete de consulta (POST /appointment-reminder) - Protegida por JWT
  app.post(
    "/appointment-reminder",
    {
      schema: {
        summary: "Enviar lembrete de consulta via WhatsApp",
        tags: ["Notificações"],
        security: [{ bearerAuth: [] }],
        body: appointmentReminderSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            message: z.string(),
          }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
          500: z.object({ message: z.string(), error: z.any().optional() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { appointmentId } = request.body;

      // Busca a consulta com dados do paciente e dentista
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          paciente: true,
          dentista: true,
        },
      });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      if (!appointment.paciente.telefone) {
        return reply.status(400).send({ message: "Paciente não possui telefone cadastrado" });
      }

      // Formata data e hora
      const appointmentDate = appointment.dataHoraInicio.toLocaleDateString('pt-BR');
      const appointmentTime = appointment.dataHoraInicio.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Formata o número de telefone
      const formattedPhone = whatsappService.formatPhoneNumber(appointment.paciente.telefone);

      // Envia o lembrete
      const result = await whatsappService.sendAppointmentReminder(
        formattedPhone,
        appointment.paciente.nome,
        appointment.dentista.nome,
        appointmentDate,
        appointmentTime
      );

      if (!result.success) {
        return reply.status(500).send({
          message: "Erro ao enviar lembrete WhatsApp",
          error: result.error,
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        message: "Lembrete enviado com sucesso",
      };
    }
  );

  // Enviar confirmação de agendamento (POST /appointment-confirmation) - Protegida por JWT
  app.post(
    "/appointment-confirmation",
    {
      schema: {
        summary: "Enviar confirmação de agendamento via WhatsApp",
        tags: ["Notificações"],
        security: [{ bearerAuth: [] }],
        body: appointmentReminderSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            message: z.string(),
          }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
          500: z.object({ message: z.string(), error: z.any().optional() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { appointmentId } = request.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          paciente: true,
          dentista: true,
        },
      });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      if (!appointment.paciente.telefone) {
        return reply.status(400).send({ message: "Paciente não possui telefone cadastrado" });
      }

      const appointmentDate = appointment.dataHoraInicio.toLocaleDateString('pt-BR');
      const appointmentTime = appointment.dataHoraInicio.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const formattedPhone = whatsappService.formatPhoneNumber(appointment.paciente.telefone);

      const result = await whatsappService.sendAppointmentConfirmation(
        formattedPhone,
        appointment.paciente.nome,
        appointment.dentista.nome,
        appointmentDate,
        appointmentTime
      );

      if (!result.success) {
        return reply.status(500).send({
          message: "Erro ao enviar confirmação WhatsApp",
          error: result.error,
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        message: "Confirmação enviada com sucesso",
      };
    }
  );

  // Enviar notificação de cancelamento (POST /appointment-cancellation) - Protegida por JWT
  app.post(
    "/appointment-cancellation",
    {
      schema: {
        summary: "Enviar notificação de cancelamento via WhatsApp",
        tags: ["Notificações"],
        security: [{ bearerAuth: [] }],
        body: appointmentReminderSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            message: z.string(),
          }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
          500: z.object({ message: z.string(), error: z.any().optional() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { appointmentId } = request.body;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          paciente: true,
        },
      });

      if (!appointment) {
        return reply.status(404).send({ message: "Consulta não encontrada" });
      }

      if (!appointment.paciente.telefone) {
        return reply.status(400).send({ message: "Paciente não possui telefone cadastrado" });
      }

      const appointmentDate = appointment.dataHoraInicio.toLocaleDateString('pt-BR');
      const appointmentTime = appointment.dataHoraInicio.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const formattedPhone = whatsappService.formatPhoneNumber(appointment.paciente.telefone);

      const result = await whatsappService.sendAppointmentCancellation(
        formattedPhone,
        appointment.paciente.nome,
        appointmentDate,
        appointmentTime
      );

      if (!result.success) {
        return reply.status(500).send({
          message: "Erro ao enviar notificação de cancelamento",
          error: result.error,
        });
      }

      return {
        success: true,
        messageId: result.messageId,
        message: "Notificação de cancelamento enviada com sucesso",
      };
    }
  );
};
