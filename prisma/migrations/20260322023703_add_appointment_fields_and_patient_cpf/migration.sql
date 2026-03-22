-- CreateTable
CREATE TABLE `DBAgenda_USUARIOS` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `senha_hash` VARCHAR(255) NOT NULL,
    `perfil` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DBAgenda_USUARIOS_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DBAgenda_DENTISTAS` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `cro` VARCHAR(20) NOT NULL,
    `especialidade` VARCHAR(100) NULL,
    `telefone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DBAgenda_DENTISTAS_cro_key`(`cro`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DBAgenda_PACIENTES` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `telefone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `data_nascimento` DATE NULL,
    `observacoes` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DBAgenda_PACIENTES_cpf_key`(`cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DBAgenda_CONSULTAS` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paciente_id` INTEGER NOT NULL,
    `dentista_id` INTEGER NOT NULL,
    `data_hora_inicio` DATETIME(3) NOT NULL,
    `data_hora_fim` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'agendada',
    `observacoes` TEXT NULL,
    `procedimento` VARCHAR(100) NULL,
    `convenio` VARCHAR(100) NULL,
    `valor_previsto` DOUBLE NULL,
    `origem_agendamento` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DBAgenda_CONSULTA_STATUS_LOG` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consulta_id` INTEGER NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `data_alteracao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuario_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DBAgenda_CONSULTAS` ADD CONSTRAINT `DBAgenda_CONSULTAS_paciente_id_fkey` FOREIGN KEY (`paciente_id`) REFERENCES `DBAgenda_PACIENTES`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DBAgenda_CONSULTAS` ADD CONSTRAINT `DBAgenda_CONSULTAS_dentista_id_fkey` FOREIGN KEY (`dentista_id`) REFERENCES `DBAgenda_DENTISTAS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DBAgenda_CONSULTA_STATUS_LOG` ADD CONSTRAINT `DBAgenda_CONSULTA_STATUS_LOG_consulta_id_fkey` FOREIGN KEY (`consulta_id`) REFERENCES `DBAgenda_CONSULTAS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DBAgenda_CONSULTA_STATUS_LOG` ADD CONSTRAINT `DBAgenda_CONSULTA_STATUS_LOG_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `DBAgenda_USUARIOS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
