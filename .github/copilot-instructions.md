# Copilot Instructions — Agenda Odontológica (Fullstack)

## VISÃO GERAL DO PROJETO
Sistema completo de gestão para consultórios odontológicos. Permite agendar consultas,
gerenciar pacientes e dentistas, visualizar dashboard com estatísticas em tempo real e
enviar notificações via WhatsApp Business API. Controla conflitos de agenda, mantém
auditoria de status e diferencia acesso por perfil de usuário.

Estrutura: monorepo com duas pastas principais — `agenda_api` (backend) e `agenda_web` (frontend).

---

## STACK

### Backend — `agenda_api/`
- **Runtime:** Bun com PM2
- **Framework:** Fastify ^5.6.2
- **Linguagem:** TypeScript ^5.9.3
- **ORM:** Prisma ^5.22.0
- **Banco:** MySQL
- **Autenticação:** JWT via @fastify/jwt ^10.0.0 + bcryptjs
- **Validação:** Zod ^4.2.1 + fastify-type-provider-zod
- **Documentação:** Swagger via @fastify/swagger
- **Deploy:** PM2 (ecosystem.config.js) ou Vercel (serverless.ts)

### Frontend — `agenda_web/`
- **Runtime:** Bun
- **Framework:** React ^18.3.1 + TypeScript ^5.8.3
- **Build:** Vite ^5.4.19
- **Roteamento:** React Router DOM ^6.30.1
- **Estado servidor:** TanStack Query ^5.83.0
- **Estado global:** Context API
- **UI:** Shadcn/ui + Radix UI + Tailwind CSS ^3.4.17
- **Formulários:** React Hook Form ^7.61.1 + Zod ^3.25.76
- **HTTP Client:** Axios ^1.13.2
- **Datas:** date-fns ^4.1.0
- **Testes:** Vitest ^4.0.17 + Testing Library
- **Alias:** `@/` mapeado para `src/`

---

## BANCO DE DADOS — TABELAS PRINCIPAIS

```prisma
// Prefixo de todas as tabelas: DBAgenda_

model User {          // DBAgenda_USUARIOS
  id         String
  nome       String
  email      String   @unique
  senhaHash  String   @map("senha_hash")
  perfil     Enum     // admin | atendente | dentista
  ativo      Boolean
  createdAt  DateTime @map("created_at")
  updatedAt  DateTime @map("updated_at")
}

model Patient {       // DBAgenda_PACIENTES
  id             String
  nome           String
  telefone       String
  email          String
  dataNascimento DateTime  @map("data_nascimento")
  observacoes    String?
  ativo          Boolean
  createdAt      DateTime  @map("created_at")
  updatedAt      DateTime  @map("updated_at")
}

model Dentist {       // DBAgenda_DENTISTAS
  id            String
  nome          String
  cro           String   @unique
  especialidade String
  telefone      String
  email         String
  ativo         Boolean
  createdAt     DateTime @map("created_at")
  updatedAt     DateTime @map("updated_at")
}

model Appointment {   // DBAgenda_CONSULTAS
  id             String
  pacienteId     String   @map("paciente_id")   // FK -> Patient
  dentistaId     String   @map("dentista_id")   // FK -> Dentist
  dataHoraInicio DateTime @map("data_hora_inicio")
  dataHoraFim    DateTime @map("data_hora_fim")
  status         Enum     // agendada | confirmada | em_andamento | concluida | cancelada
  observacoes    String?
  createdAt      DateTime @map("created_at")
  updatedAt      DateTime @map("updated_at")
}

model StatusLog {     // DBAgenda_CONSULTA_STATUS_LOG
  id            String
  consultaId    String   @map("consulta_id")  // FK -> Appointment
  status        String
  dataAlteracao DateTime @map("data_alteracao")
  usuarioId     String   @map("usuario_id")   // FK -> User
}
```

---

## ESTRUTURA DE PASTAS

```
projeto/
├── agenda_api/                  # Backend
│   ├── src/
│   │   ├── app.ts               # Configuração Fastify + plugins
│   │   ├── server.ts            # Entry point local
│   │   ├── serverless.ts        # Entry point Vercel
│   │   ├── routes/              # Endpoints por entidade
│   │   └── services/
│   │       └── whatsappService.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── ecosystem.config.js      # Configuração PM2
│   ├── vercel.json
│   └── .env
│
└── agenda_web/                  # Frontend
    └── src/
        ├── App.tsx
        ├── contexts/
        │   └── AuthContext.tsx
        ├── config/
        │   └── api.ts           # Axios + interceptors JWT
        ├── types/
        │   └── api.ts           # Tipos TypeScript da API
        ├── schemas/
        │   └── forms.ts         # Schemas Zod
        ├── services/
        │   ├── authService.ts
        │   ├── patientService.ts
        │   ├── dentistService.ts
        │   ├── appointmentService.ts
        │   ├── dashboardService.ts
        │   └── notificationService.ts
        ├── hooks/
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── Agendamentos.tsx
        │   ├── Pacientes.tsx
        │   ├── Doutores.tsx
        │   ├── Calendario.tsx
        │   ├── NotificationSettings.tsx
        │   └── Configuracoes.tsx
        └── components/
            ├── ProtectedRoute.tsx
            ├── ErrorBoundary.tsx
            └── ui/              # 40+ componentes Shadcn/ui
```

---

## REGRAS DE NEGÓCIO

1. **Conflito de horário:** Antes de criar/atualizar consulta, verificar se o dentista já tem consulta no mesmo período (exceto canceladas)
2. **Auditoria de status:** Toda mudança de status grava em `StatusLog` com usuário e data/hora
3. **Soft delete:** Pacientes, dentistas e usuários usam flag `ativo: boolean` — nunca deletar fisicamente
4. **Perfis JWT:** `admin`, `atendente`, `dentista` — perfil viaja dentro do token
5. **Rotas protegidas:** Todas exceto `/auth/login` e `/auth/register` exigem JWT válido
6. **Fluxo de status:** `agendada → confirmada → em_andamento → concluida`. Saída alternativa: `cancelada`
7. **Notificações WhatsApp:** Lembretes automáticos com dados do paciente, dentista, data e horário
8. **Dashboard dinâmico:** Consultas de hoje, aguardando, concluídas e próximos 7 dias — calculados em tempo real
9. **Senha:** mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial

---

## PADRÕES E CONVENÇÕES

### Nomenclatura por camada
| Camada | Padrão | Exemplo |
|---|---|---|
| MySQL (físico) | snake_case | `data_hora_inicio`, `senha_hash` |
| Prisma schema | camelCase + `@map()` | `dataHoraInicio @map("data_hora_inicio")` |
| API (retorno JSON) | camelCase | `dataHoraInicio`, `pacienteId` |
| Frontend tipos/componentes | PascalCase / camelCase | `Appointment`, `patientService` |

### Retorno padrão da API
```typescript
// Sucesso
{ ...dados }                          // 200 / 201

// Erro de validação
{ message: string }                   // 400

// Não autorizado
{ message: "Unauthorized" }           // 401

// Não encontrado
{ message: string }                   // 404

// Erro de servidor
{ message: string, error?: any }      // 500
```

### Paginação — ✅ Implementada no backend
Todas as rotas de listagem (`pacientes`, `dentistas`, `consultas`, `usuários`) aceitam:

| Query param | Tipo | Padrão | Validação |
|---|---|---|---|
| `page` | number inteiro | `1` | min(1) |
| `size` | number inteiro | `10` | min(1), max(100) |

Usar `z.coerce.number()` no schema Zod para converter string da URL para número automaticamente.

```typescript
// Schema Zod padrão de paginação (igual em todas as rotas)
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
})

// Resposta padrão de todas as listagens
interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// Implementação Prisma padrão
const [items, total] = await Promise.all([
  prisma.model.findMany({
    where,           // mesmo where dos filtros ativos
    skip: (page - 1) * size,
    take: size,
  }),
  prisma.model.count({ where })  // OBRIGATÓRIO: usar o mesmo where para total correto com filtros
])

return {
  items,
  total,
  page,
  size,
  pages: Math.ceil(total / size)
}
```

> ⚠️ **Atenção em `appointment.routes.ts`:** O `count` deve receber o mesmo objeto `where`
> montado com os filtros ativos (`pacienteId`, `dentistaId`, `status`, `dataInicio`, `dataFim`).
> Chamar `count` sem `where` quebra a paginação quando filtros estão aplicados.

> ⚠️ **Proteção de `senhaHash` em `auth.routes.ts`:** Dupla proteção obrigatória:
> 1. `select` do Prisma excluindo o campo
> 2. `userItemSchema` no Zod descartando qualquer campo não declarado

> ⚠️ **Frontend pendente (problema #15):** Os services do frontend ainda usam `skip`/`limit`
> em vez de `page`/`size`. Isso causa divergência silenciosa — params são ignorados pelo backend
> e sempre retorna página 1. Ver problema #15 na tabela abaixo.

---

## INTEGRAÇÕES EXTERNAS

| Serviço | Endpoint base | Para quê |
|---|---|---|
| WhatsApp Business API | https://graph.facebook.com/v21.0 | Lembretes e confirmações |
| MySQL | via `DATABASE_URL` | Banco principal |

> ⚠️ SMS e e-mail estão nos tipos do frontend mas **não implementados no backend**.
> Não sugerir uso desses canais sem implementar o backend primeiro.

---

## VARIÁVEIS DE AMBIENTE

### Backend — `agenda_api/.env`
```
DATABASE_URL              # String de conexão MySQL
JWT_SECRET                # Nunca usar valor padrão em produção
WHATSAPP_TOKEN            # Token WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID  # ID do número WhatsApp
PORT                      # Padrão: 8080
NODE_ENV                  # development | production
```

### Frontend — `agenda_web/.env`
```
VITE_API_URL   # URL base da API — sempre definir, nunca depender do fallback
NODE_ENV
```

---

## COMO EXECUTAR

### Backend
```bash
cd agenda_api
bun install
bunx prisma generate
bunx prisma migrate dev
bun run dev
```

### Frontend
```bash
cd agenda_web
bun install
cp .env.example .env   # definir VITE_API_URL
bun run dev            # http://localhost:5173
```

---

## ⚠️ PROBLEMAS CONHECIDOS

Ao sugerir código nessas áreas, já incluir a correção:

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 1 | `agenda_api/src/app.ts:23` | JWT_SECRET com valor padrão `"minha-chave-secreta"` | Sempre exigir via variável de ambiente |
| 2 | `agenda_api/src/app.ts` | CORS `origin: "*"` | Restringir ao domínio do frontend em produção |
| 3 | `agenda_api` (routes) | `usuarioId: || 1` hardcoded como fallback | Corrigir extração do JWT |
| 4 | `agenda_api/package.json` | Marcadores de conflito de merge não resolvidos | Manter ambas as dependências |
| 5 | `agenda_api` | ~~Paginação não implementada no backend~~ | ✅ **Resolvido** — implementado em todas as rotas |
| 6 | `agenda_api` | Deploy duplo PM2 + Vercel | Definir um método e remover o outro |
| 7 | `agenda_web/src/config/api.ts` | IP `104.234.30.22:8080` hardcoded no fallback | Sempre exigir `VITE_API_URL` |
| 8 | `agenda_web/src/services/appointmentService.ts` | `data: any` no método `create` | Usar tipo `AppointmentCreate` |
| 9 | `agenda_web/src/App.tsx` | Dois sistemas de toast: Radix + Sonner | Padronizar para Sonner |
| 10 | `agenda_web/src/contexts/AuthContext.tsx` | Token não validado no cliente — só verifica presença | Verificar expiração |
| 11 | `agenda_web/src/contexts/AuthContext.tsx` | Tipo `User` importado mas não usado | Usar tipo da API no estado |
| 12 | `agenda_web/src/pages/Configuracoes.tsx:37` | `clinicPhone` hardcoded | Carregar da API |
| 13 | `agenda_web/src/hooks/use-plans.ts` | Planos só no localStorage | Sincronizar com backend |
| 14 | `agenda_web/src/types/api.ts:184` | SMS/Email nos tipos sem implementação no backend | Não usar sem implementar |
| 15 | `agenda_web/src/services/` | Services usam `skip`/`limit` em vez de `page`/`size` — divergência silenciosa com o backend | Atualizar todos os services e conectar ao componente `Pagination.tsx` nas páginas `Pacientes.tsx`, `Doutores.tsx`, `Agendamentos.tsx` |

---

## INSTRUÇÃO GERAL

- Nunca usar `any` — tipar com interfaces de `types/api.ts`
- Campos do banco: sempre `@map()` no Prisma para manter snake_case no MySQL e camelCase no código
- Soft delete: nunca deletar fisicamente — usar `ativo: false`
- Todo `DELETE` deve aceitar `{ reason }` no body
- Toda mudança de status de consulta deve gravar em `StatusLog`
- Novos endpoints seguem o padrão de retorno definido acima
- Novos formulários: `react-hook-form` + `zodResolver`
- Toasts: apenas `Sonner`
- Componentes: usar `shadcn/ui` via `@/components/ui/`
- Importações frontend: sempre usar alias `@/`
