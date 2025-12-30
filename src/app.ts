import fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { authRoutes } from "./routes/auth.routes";
import { patientRoutes } from "./routes/patient.routes";
import { dentistRoutes } from "./routes/dentist.routes";
import { appointmentRoutes } from "./routes/appointment.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";

export const app = fastify(); // Exportamos o app sem dar listen ainda

// 1. Configurações Gerais
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(cors, { origin: "*" });

app.register(jwt, {
  secret: process.env.JWT_SECRET || "minha-chave-secreta",
});

// 2. Swagger
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "API Consultório",
      description: "API rodando na Vercel",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  transform: jsonSchemaTransform,
});

app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

// 3. Rotas
app.register(authRoutes, { prefix: "/api/auth" });
app.register(patientRoutes, { prefix: "/api/patients" });
app.register(dentistRoutes, { prefix: "/api/dentists" });
app.register(appointmentRoutes, { prefix: "/api/appointments" });
app.register(dashboardRoutes, { prefix: "/api/dashboard" });