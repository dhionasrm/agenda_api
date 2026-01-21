import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessage {
  to: string; // Número de telefone com código do país (ex: 5511999999999)
  message: string;
}

interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
}

export class WhatsAppService {
  private token: string;
  private phoneNumberId: string;

  constructor() {
    this.token = process.env.WHATSAPP_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    if (!this.token || !this.phoneNumberId) {
      console.warn('WhatsApp credentials not configured in .env');
    }
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendTextMessage(data: WhatsAppMessage): Promise<any> {
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: data.to,
          type: 'text',
          text: {
            preview_url: false,
            body: data.message,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Envia mensagem usando template aprovado
   */
  async sendTemplateMessage(data: WhatsAppTemplateMessage): Promise<any> {
    try {
      const components = data.parameters
        ? [
            {
              type: 'body',
              parameters: data.parameters.map((param) => ({
                type: 'text',
                text: param,
              })),
            },
          ]
        : [];

      const response = await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: data.to,
          type: 'template',
          template: {
            name: data.templateName,
            language: {
              code: data.languageCode || 'pt_BR',
            },
            components,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error sending WhatsApp template:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Envia lembrete de consulta para paciente
   */
  async sendAppointmentReminder(
    phoneNumber: string,
    patientName: string,
    doctorName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<any> {
    const message = `Olá ${patientName}! 👋\n\n` +
      `Este é um lembrete da sua consulta:\n\n` +
      `📅 Data: ${appointmentDate}\n` +
      `🕐 Horário: ${appointmentTime}\n` +
      `👨‍⚕️ Dentista: ${doctorName}\n\n` +
      `Por favor, chegue com 10 minutos de antecedência.\n\n` +
      `Em caso de imprevistos, entre em contato conosco.`;

    return this.sendTextMessage({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Envia confirmação de agendamento
   */
  async sendAppointmentConfirmation(
    phoneNumber: string,
    patientName: string,
    doctorName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<any> {
    const message = `✅ Consulta agendada com sucesso!\n\n` +
      `Olá ${patientName},\n\n` +
      `Sua consulta foi confirmada:\n\n` +
      `📅 Data: ${appointmentDate}\n` +
      `🕐 Horário: ${appointmentTime}\n` +
      `👨‍⚕️ Dentista: ${doctorName}\n\n` +
      `Aguardamos você! 😊`;

    return this.sendTextMessage({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Envia notificação de cancelamento
   */
  async sendAppointmentCancellation(
    phoneNumber: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<any> {
    const message = `❌ Consulta cancelada\n\n` +
      `Olá ${patientName},\n\n` +
      `Sua consulta foi cancelada:\n\n` +
      `📅 Data: ${appointmentDate}\n` +
      `🕐 Horário: ${appointmentTime}\n\n` +
      `Para reagendar, entre em contato conosco.`;

    return this.sendTextMessage({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Formata número de telefone para padrão internacional
   * Remove caracteres especiais e adiciona código do país se necessário
   */
  formatPhoneNumber(phone: string): string {
    // Remove caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');

    // Se não começar com 55 (Brasil), adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }
}

export const whatsappService = new WhatsAppService();
