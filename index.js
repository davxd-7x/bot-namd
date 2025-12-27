const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración del cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
    ]
});

// Inicializar base de datos SQLite
const db = new sqlite3.Database(path.join(__dirname, 'erlc.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
    } else {
        console.log('✅ Base de datos SQLite conectada');
        initDatabase();
    }
});

// Crear tablas necesarias
function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS sanciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        razon TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        activa INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS arrestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        nombre_ic TEXT NOT NULL,
        oficial_id TEXT NOT NULL,
        detalles TEXT NOT NULL,
        articulos TEXT NOT NULL,
        tiempo_prision TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        activo INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vehiculos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        modelo TEXT NOT NULL,
        color TEXT NOT NULL,
        placa TEXT NOT NULL UNIQUE,
        imagen_url TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cedulas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        numero_cedula TEXT NOT NULL UNIQUE,
        nombre_completo TEXT NOT NULL,
        fecha_nacimiento TEXT NOT NULL,
        tipo TEXT NOT NULL,
        fecha_expedicion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS incautaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        detalle TEXT NOT NULL,
        oficial_id TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('✅ Tablas de base de datos inicializadas');
}

// IDs de configuración
const CONFIG = {
    STAFF_ROLE_ID: '1327736976475947049', // Cambiar por el ID del rol de staff
    POLICE_ROLE_ID: '1327736976345923753', // Cambiar por el ID del rol de policía
    ARMY_ROLE_ID: '1327736976345923754', // Cambiar por el ID del rol de ejército
    CTI_ROLE_ID: '1327736976345923757', // Cambiar por el ID del rol de CTI
    ANTECEDENTES_ROLE_ID: '1327736976345923752', // Rol de antecedentes penales
    NO_ARMAS_ROLE_ID: '1327736976345923751', // Rol de prohibición de armas
    VOTACION_CHANNEL_ID: '1327736979055443980', // Canal para votaciones
    ANUNCIOS_CHANNEL_ID: '1327736979055443979', // Canal para anuncios
};

// Estado del servidor
let servidorAbierto = false;

// Evento: Bot listo
client.once('ready', () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    client.user.setActivity('Antioquia RP', { type: 'WATCHING' });
});

// Registrar comandos slash
client.on('ready', async () => {
    const commands = [
        {
            name: 'votación',
            description: '🗳️ Inicia una votación sobre la apertura del servidor'
        },
        {
            name: 'abrir-sv',
            description: '🟢 Abre el servidor oficialmente'
        },
        {
            name: 'cerrar-sv',
            description: '🔴 Cierra el servidor temporalmente'
        },
        {
            name: 'sancionar',
            description: '⚖️ Abre el panel de sanciones',
            options: [{
                name: 'usuario',
                type: 6, // USER
                description: 'Usuario a sancionar',
                required: true
            }]
        },
        {
            name: 'ver-sanciones',
            description: '📋 Muestra las sanciones de un usuario',
            options: [{
                name: 'usuario',
                type: 6,
                description: 'Usuario a consultar',
                required: false
            }]
        },
        {
            name: 'arrestar',
            description: '🚔 Registra un arresto',
            options: [
                {
                    name: 'usuario',
                    type: 6,
                    description: 'Usuario arrestado',
                    required: true
                },
                {
                    name: 'nombre_ic',
                    type: 3, // STRING
                    description: 'Nombre IC del arrestado',
                    required: true
                },
                {
                    name: 'detalles',
                    type: 3,
                    description: 'Detalles del hecho',
                    required: true
                },
                {
                    name: 'articulos',
                    type: 3,
                    description: 'Artículos violentados',
                    required: true
                },
                {
                    name: 'tiempo',
                    type: 3,
                    description: 'Tiempo en prisión (ej: 30 minutos)',
                    required: true
                }
            ]
        },
        {
            name: 'ver-arrestos',
            description: '📋 Lista los arrestos activos'
        },
        {
            name: 'buscar-arrestos',
            description: '🔍 Busca arrestos de un usuario',
            options: [{
                name: 'usuario',
                type: 6,
                description: 'Usuario a buscar',
                required: true
            }]
        },
        {
            name: 'registrar-vehículo',
            description: '🚗 Registra un vehículo en el RUNT',
            options: [
                {
                    name: 'modelo',
                    type: 3,
                    description: 'Modelo del vehículo',
                    required: true
                },
                {
                    name: 'color',
                    type: 3,
                    description: 'Color del vehículo',
                    required: true
                },
                {
                    name: 'placa',
                    type: 3,
                    description: 'Placa del vehículo (formato: ABC123)',
                    required: true
                },
                {
                    name: 'imagen',
                    type: 3,
                    description: 'URL de la imagen del vehículo',
                    required: false
                }
            ]
        },
        {
            name: 'ver-vehículos',
            description: '🚙 Muestra tus vehículos registrados',
            options: [{
                name: 'usuario',
                type: 6,
                description: 'Usuario a consultar (opcional)',
                required: false
            }]
        },
        {
            name: 'incautar',
            description: '🔒 Incauta armas o vehículos',
            options: [
                {
                    name: 'usuario',
                    type: 6,
                    description: 'Usuario a incautar',
                    required: true
                },
                {
                    name: 'tipo',
                    type: 3,
                    description: 'Tipo de incautación',
                    required: true,
                    choices: [
                        { name: 'Arma', value: 'arma' },
                        { name: 'Vehículo', value: 'vehiculo' }
                    ]
                },
                {
                    name: 'detalle',
                    type: 3,
                    description: 'Detalles de la incautación',
                    required: true
                }
            ]
        },
        {
            name: 'crear-cédula',
            description: '🆔 Crea una cédula de identificación',
            options: [
                {
                    name: 'numero',
                    type: 3,
                    description: 'Número de cédula (10 dígitos)',
                    required: true
                },
                {
                    name: 'nombre_completo',
                    type: 3,
                    description: 'Nombre completo',
                    required: true
                },
                {
                    name: 'fecha_nacimiento',
                    type: 3,
                    description: 'Fecha de nacimiento (DD/MM/AAAA)',
                    required: true
                },
                {
                    name: 'tipo',
                    type: 3,
                    description: 'Tipo de cédula',
                    required: true,
                    choices: [
                        { name: 'Ciudadanía', value: 'ciudadania' },
                        { name: 'Extranjería', value: 'extranjeria' }
                    ]
                }
            ]
        },
        {
            name: 'recopilar-info',
            description: '📊 Recopila información completa de un ciudadano',
            options: [{
                name: 'usuario',
                type: 6,
                description: 'Usuario a consultar',
                required: true
            }]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ Comandos slash registrados correctamente');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
});

// Manejador de comandos
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'votación':
                await handleVotacion(interaction);
                break;
            case 'abrir-sv':
                await handleAbrirServidor(interaction);
                break;
            case 'cerrar-sv':
                await handleCerrarServidor(interaction);
                break;
            case 'sancionar':
                await handleSancionar(interaction);
                break;
            case 'ver-sanciones':
                await handleVerSanciones(interaction);
                break;
            case 'arrestar':
                await handleArrestar(interaction);
                break;
            case 'ver-arrestos':
                await handleVerArrestos(interaction);
                break;
            case 'buscar-arrestos':
                await handleBuscarArrestos(interaction);
                break;
            case 'registrar-vehículo':
                await handleRegistrarVehiculo(interaction);
                break;
            case 'ver-vehículos':
                await handleVerVehiculos(interaction);
                break;
            case 'incautar':
                await handleIncautar(interaction);
                break;
            case 'crear-cédula':
                await handleCrearCedula(interaction);
                break;
            case 'recopilar-info':
                await handleRecopilarInfo(interaction);
                break;
        }
    } catch (error) {
        console.error(`Error ejecutando comando ${commandName}:`, error);
        await interaction.reply({ content: '❌ Ocurrió un error al ejecutar el comando.', ephemeral: true });
    }
});

// FUNCIONES DE COMANDOS

async function handleVotacion(interaction) {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
        return interaction.reply({ content: '❌ No tienes permisos para iniciar votaciones.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🗳️ VOTACIÓN DE APERTURA')
        .setDescription('**¡El staff ha iniciado una votación para decidir si abrir el servidor!**\n\n¿Están listos para sumergirse en una sesión épica de roleplay? Vuestra voz importa. Cada voto cuenta para que esta comunidad crezca y se fortalezca.\n\n**Vota a continuación:**')
        .addFields(
            { name: '✅ A Favor', value: 'Quiero que abra el servidor', inline: true },
            { name: '❌ En Contra', value: 'Prefiero esperar', inline: true }
        )
        .setFooter({ text: 'Votación activa • Antioquia RP' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('votar_si')
                .setLabel('✅ A Favor')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('votar_no')
                .setLabel('❌ En Contra')
                .setStyle(ButtonStyle.Danger)
        );

    const channel = await client.channels.fetch(CONFIG.VOTACION_CHANNEL_ID);
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Votación iniciada correctamente.', ephemeral: true });
}

async function handleAbrirServidor(interaction) {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
        return interaction.reply({ content: '❌ No tienes permisos para abrir el servidor.', ephemeral: true });
    }

    servidorAbierto = true;

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🟢 ¡SERVIDOR ABIERTO!')
        .setDescription('**¡Las puertas del servidor están oficialmente abiertas!**\n\nEs hora de vivir historias inolvidables, crear momentos únicos y demostrar por qué somos la mejor comunidad de roleplay. Que comience la acción, que fluya la interpretación, y que cada uno de ustedes brille en su rol.\n\n**¡Nos vemos en la ciudad!** 🚔🏙️')
        .addFields(
            { name: '📌 Estado', value: '**ABIERTO**', inline: true },
            { name: '👤 Abierto por', value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: 'Antioquia RP • Servidor Online' })
        .setTimestamp();

    const channel = await client.channels.fetch(CONFIG.ANUNCIOS_CHANNEL_ID);
    await channel.send({ content: '@everyone', embeds: [embed] });
    await interaction.reply({ content: '✅ Servidor abierto correctamente.', ephemeral: true });
}

async function handleCerrarServidor(interaction) {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
        return interaction.reply({ content: '❌ No tienes permisos para cerrar el servidor.', ephemeral: true });
    }

    servidorAbierto = false;

    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔴 SERVIDOR CERRADO')
        .setDescription('**El servidor ha sido cerrado temporalmente.**\n\nGracias a todos por su participación y dedicación. Cada sesión es una aventura gracias a ustedes. Descansen, recarguen energías y prepárense para la próxima apertura.\n\n**¡Hasta pronto, ciudadanos!** 👋')
        .addFields(
            { name: '📌 Estado', value: '**CERRADO**', inline: true },
            { name: '👤 Cerrado por', value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: 'Antioquia RP • Servidor Offline' })
        .setTimestamp();

    const channel = await client.channels.fetch(CONFIG.ANUNCIOS_CHANNEL_ID);
    await channel.send({ content: '@everyone', embeds: [embed] });
    await interaction.reply({ content: '✅ Servidor cerrado correctamente.', ephemeral: true });
}

async function handleSancionar(interaction) {
    if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
        return interaction.reply({ content: '❌ No tienes permisos para sancionar.', ephemeral: true });
    }

    const usuario = interaction.options.getUser('usuario');

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚖️ Panel de Sanciones')
        .setDescription(`Selecciona el tipo de sanción para ${usuario}`)
        .setFooter({ text: 'Antioquia RP' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`sancion_verbal_${usuario.id}`)
                .setLabel('Advertencia Verbal')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sancion_escrita_${usuario.id}`)
                .setLabel('Advertencia Escrita')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sancion_baneo_${usuario.id}`)
                .setLabel('Baneo')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`sancion_muteo_${usuario.id}`)
                .setLabel('Muteo')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleVerSanciones(interaction) {
    const usuario = interaction.options.getUser('usuario') || interaction.user;

    db.all('SELECT * FROM sanciones WHERE user_id = ? AND activa = 1', [usuario.id], (err, rows) => {
        if (err) {
            return interaction.reply({ content: '❌ Error al consultar sanciones.', ephemeral: true });
        }

        if (rows.length === 0) {
            return interaction.reply({ content: `✅ ${usuario} no tiene sanciones activas.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle(`📋 Sanciones de ${usuario.username}`)
            .setDescription(`Total de sanciones activas: ${rows.length}`)
            .setFooter({ text: 'Antioquia RP' });

        rows.forEach((row, index) => {
            embed.addFields({
                name: `Sanción #${index + 1} - ${row.tipo}`,
                value: `**Razón:** ${row.razon}\n**Fecha:** ${new Date(row.fecha).toLocaleDateString()}`
            });
        });

        interaction.reply({ embeds: [embed], ephemeral: true });
    });
}

async function handleArrestar(interaction) {
    const hasPermission = interaction.member.roles.cache.has(CONFIG.POLICE_ROLE_ID) ||
                          interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);

    if (!hasPermission) {
        return interaction.reply({ content: '❌ Solo el personal policial puede arrestar.', ephemeral: true });
    }

    const usuario = interaction.options.getUser('usuario');
    const nombreIC = interaction.options.getString('nombre_ic');
    const detalles = interaction.options.getString('detalles');
    const articulos = interaction.options.getString('articulos');
    const tiempo = interaction.options.getString('tiempo');

    db.run(
        'INSERT INTO arrestos (user_id, nombre_ic, oficial_id, detalles, articulos, tiempo_prision) VALUES (?, ?, ?, ?, ?, ?)',
        [usuario.id, nombreIC, interaction.user.id, detalles, articulos, tiempo],
        async (err) => {
            if (err) {
                return interaction.reply({ content: '❌ Error al registrar arresto.', ephemeral: true });
            }

            // Añadir roles
            const member = await interaction.guild.members.fetch(usuario.id);
            await member.roles.add(CONFIG.ANTECEDENTES_ROLE_ID);
            await member.roles.add(CONFIG.NO_ARMAS_ROLE_ID);

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🚔 ARRESTO REGISTRADO')
                .addFields(
                    { name: '👤 Arrestado', value: `${usuario} (${nombreIC})`, inline: true },
                    { name: '👮 Oficial', value: `${interaction.user}`, inline: true },
                    { name: '⏱️ Tiempo', value: tiempo, inline: true },
                    { name: '📝 Detalles', value: detalles },
                    { name: '⚖️ Artículos', value: articulos }
                )
                .setFooter({ text: 'Antioquia RP' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    );
}

async function handleVerArrestos(interaction) {
    db.all('SELECT * FROM arrestos WHERE activo = 1', [], (err, rows) => {
        if (err || rows.length === 0) {
            return interaction.reply({ content: '📋 No hay arrestos activos.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Arrestos Activos')
            .setDescription(`Total: ${rows.length} arrestos`)
            .setFooter({ text: 'Antioquia RP' });

        rows.slice(0, 10).forEach((row, index) => {
            embed.addFields({
                name: `Arresto #${row.id}`,
                value: `**Usuario:** <@${row.user_id}>\n**Nombre IC:** ${row.nombre_ic}\n**Tiempo:** ${row.tiempo_prision}`
            });
        });

        interaction.reply({ embeds: [embed], ephemeral: true });
    });
}

async function handleBuscarArrestos(interaction) {
    const usuario = interaction.options.getUser('usuario');

    db.all('SELECT * FROM arrestos WHERE user_id = ?', [usuario.id], (err, rows) => {
        if (err || rows.length === 0) {
            return interaction.reply({ content: `✅ ${usuario} no tiene arrestos registrados.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🔍 Arrestos de ${usuario.username}`)
            .setDescription(`Total: ${rows.length} arrestos`)
            .setFooter({ text: 'Antioquia RP' });

        rows.forEach((row) => {
            embed.addFields({
                name: `Arresto #${row.id} - ${row.nombre_ic}`,
                value: `**Detalles:** ${row.detalles}\n**Artículos:** ${row.articulos}\n**Fecha:** ${new Date(row.fecha).toLocaleDateString()}`
            });
        });

        interaction.reply({ embeds: [embed], ephemeral: true });
    });
}

async function handleRegistrarVehiculo(interaction) {
    const modelo = interaction.options.getString('modelo');
    const color = interaction.options.getString('color');
    const placa = interaction.options.getString('placa').toUpperCase();
    const imagen = interaction.options.getString('imagen') || null;

    // Validar formato de placa
    if (!/^[A-Z]{3}\d{3}$/.test(placa)) {
        return interaction.reply({ content: '❌ Formato de placa inválido. Usa el formato ABC123.', ephemeral: true });
    }

    db.run(
        'INSERT INTO vehiculos (user_id, modelo, color, placa, imagen_url) VALUES (?, ?, ?, ?, ?)',
        [interaction.user.id, modelo, color, placa, imagen],
        (err) => {
            if (err) {
                return interaction.reply({ content: '❌ Esta placa ya está registrada.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🚗 VEHÍCULO REGISTRADO EN EL RUNT')
                .addFields(
                    { name: '🚙 Modelo', value: modelo, inline: true },
                    { name: '🎨 Color', value: color, inline: true },
                    { name: '🔖 Placa', value: placa, inline: true },
                    { name: '👤 Propietario', value: `${interaction.user}` }
                )
                .setFooter({ text: 'Antioquia RP • RUNT' })
                .setTimestamp();

            if (imagen) embed.setImage(imagen);

            interaction.reply({ embeds: [embed] });
        }
    );
}

async function handleVerVehiculos(interaction) {
    const usuario = interaction.options.getUser('usuario') || interaction.user;

    db.all('SELECT * FROM vehiculos WHERE user_id = ?', [usuario.id], (err, rows) => {
        if (err || rows.length === 0) {
            return interaction.reply({ content: `🚗 ${usuario} no tiene vehículos registrados.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🚙 Vehículos de ${usuario.username}`)
            .setDescription(`Total: ${rows.length} vehículos`)
            .setFooter({ text: 'Antioquia RP • RUNT' });

        rows.forEach((row) => {
            embed.addFields({
                name: `${row.modelo} - ${row.placa}`,
                value: `**Color:** ${row.color}\n**Registrado:** ${new Date(row.fecha_registro).toLocaleDateString()}`
            });
        });

        interaction.reply({ embeds: [embed], ephemeral: true });
    });
}

async function handleIncautar(interaction) {
    const hasPermission = interaction.member.roles.cache.has(CONFIG.POLICE_ROLE_ID) ||
                          interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);

    if (!hasPermission) {
        return interaction.reply({ content: '❌ Solo el personal autorizado puede incautar.', ephemeral: true });
    }

    const usuario = interaction.options.getUser('usuario');
    const tipo = interaction.options.getString('tipo');
    const detalle = interaction.options.getString('detalle');

    db.run(
        'INSERT INTO incautaciones (user_id, tipo, detalle, oficial_id) VALUES (?, ?, ?, ?)',
        [usuario.id, tipo, detalle, interaction.user.id],
        async (err) => {
            if (err) {
                return interaction.reply({ content: '❌ Error al registrar incautación.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('🔒 INCAUTACIÓN REGISTRADA')
                .addFields(
                    { name: '👤 Usuario', value: `${usuario}`, inline: true },
                    { name: '📦 Tipo', value: tipo, inline: true },
                    { name: '👮 Oficial', value: `${interaction.user}`, inline: true },
                    { name: '📝 Detalle', value: detalle }
                )
                .setFooter({ text: 'Antioquia RP' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    );
}

async function handleCrearCedula(interaction) {
    const numero = interaction.options.getString('numero');
    const nombreCompleto = interaction.options.getString('nombre_completo');
    const fechaNacimiento = interaction.options.getString('fecha_nacimiento');
    const tipo = interaction.options.getString('tipo');

    // Validaciones
    if (!/^\d{10}$/.test(numero)) {
        return interaction.reply({ content: '❌ El número de cédula debe tener 10 dígitos.', ephemeral: true });
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNacimiento)) {
        return interaction.reply({ content: '❌ Formato de fecha inválido. Usa DD/MM/AAAA.', ephemeral: true });
    }

    // Validar edad (mayor de 18)
    const [dia, mes, año] = fechaNacimiento.split('/').map(Number);
    const fechaNac = new Date(año, mes - 1, dia);
    const edad = Math.floor((Date.now() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000));

    if (edad < 18) {
        return interaction.reply({ content: '❌ Debes ser mayor de 18 años para obtener una cédula.', ephemeral: true });
    }

    db.run(
        'INSERT INTO cedulas (user_id, numero_cedula, nombre_completo, fecha_nacimiento, tipo) VALUES (?, ?, ?, ?, ?)',
        [interaction.user.id, numero, nombreCompleto, fechaNacimiento, tipo],
        (err) => {
            if (err) {
                return interaction.reply({ content: '❌ Ya tienes una cédula registrada o este número ya existe.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🆔 CÉDULA DE ${tipo.toUpperCase()}`)
                .addFields(
                    { name: '📋 Número', value: numero, inline: true },
                    { name: '👤 Nombre Completo', value: nombreCompleto, inline: true },
                    { name: '🎂 Fecha de Nacimiento', value: fechaNacimiento, inline: true },
                    { name: '🎯 Edad', value: `${edad} años`, inline: true },
                    { name: '📅 Fecha de Expedición', value: new Date().toLocaleDateString(), inline: true }
                )
                .setFooter({ text: 'Antioquia RP • Registro Civil' })
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        }
    );
}

async function handleRecopilarInfo(interaction) {
    const hasPermission = interaction.member.roles.cache.has(CONFIG.POLICE_ROLE_ID) ||
                          interaction.member.roles.cache.has(CONFIG.ARMY_ROLE_ID) ||
                          interaction.member.roles.cache.has(CONFIG.CTI_ROLE_ID) ||
                          interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);

    if (!hasPermission) {
        return interaction.reply({ content: '❌ No tienes permisos para recopilar información.', ephemeral: true });
    }

    const usuario = interaction.options.getUser('usuario');
    await interaction.deferReply({ ephemeral: true });

    // Obtener toda la información del usuario
    const info = {
        cedula: null,
        vehiculos: [],
        arrestos: [],
        sanciones: [],
        incautaciones: []
    };

    // Promesas para consultar la base de datos
    const promesas = [
        new Promise((resolve) => {
            db.get('SELECT * FROM cedulas WHERE user_id = ?', [usuario.id], (err, row) => {
                if (row) info.cedula = row;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.all('SELECT * FROM vehiculos WHERE user_id = ?', [usuario.id], (err, rows) => {
                if (rows) info.vehiculos = rows;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.all('SELECT * FROM arrestos WHERE user_id = ?', [usuario.id], (err, rows) => {
                if (rows) info.arrestos = rows;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.all('SELECT * FROM sanciones WHERE user_id = ? AND activa = 1', [usuario.id], (err, rows) => {
                if (rows) info.sanciones = rows;
                resolve();
            });
        }),
        new Promise((resolve) => {
            db.all('SELECT * FROM incautaciones WHERE user_id = ?', [usuario.id], (err, rows) => {
                if (rows) info.incautaciones = rows;
                resolve();
            });
        })
    ];

    await Promise.all(promesas);

    // Verificar si tiene antecedentes
    const member = await interaction.guild.members.fetch(usuario.id);
    const tieneAntecedentes = member.roles.cache.has(CONFIG.ANTECEDENTES_ROLE_ID);
    const prohibidoArmas = member.roles.cache.has(CONFIG.NO_ARMAS_ROLE_ID);

    // Crear embed con toda la información
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 INFORMACIÓN COMPLETA - ${usuario.username}`)
        .setThumbnail(usuario.displayAvatarURL())
        .setDescription(`**Consultado por:** ${interaction.user}\n**Fecha:** ${new Date().toLocaleString()}`)
        .setFooter({ text: 'Antioquia RP • Sistema de Información' });

    // Cédula
    if (info.cedula) {
        embed.addFields({
            name: '🆔 CÉDULA DE IDENTIDAD',
            value: `**Número:** ${info.cedula.numero_cedula}\n**Nombre:** ${info.cedula.nombre_completo}\n**Fecha de Nacimiento:** ${info.cedula.fecha_nacimiento}\n**Tipo:** ${info.cedula.tipo.toUpperCase()}`
        });
    } else {
        embed.addFields({ name: '🆔 CÉDULA DE IDENTIDAD', value: '❌ Sin cédula registrada' });
    }

    // Antecedentes
    embed.addFields({
        name: '⚠️ ANTECEDENTES PENALES',
        value: tieneAntecedentes ? '🔴 **SÍ TIENE ANTECEDENTES**' : '✅ Sin antecedentes'
    });

    // Prohibición de armas
    embed.addFields({
        name: '🔫 PORTE DE ARMAS',
        value: prohibidoArmas ? '🔴 **PROHIBIDO**' : '✅ Permitido'
    });

    // Vehículos
    if (info.vehiculos.length > 0) {
        const vehiculosText = info.vehiculos.map(v => 
            `• ${v.modelo} - Placa: **${v.placa}** (${v.color})`
        ).join('\n');
        embed.addFields({ name: `🚗 VEHÍCULOS REGISTRADOS (${info.vehiculos.length})`, value: vehiculosText });
    } else {
        embed.addFields({ name: '🚗 VEHÍCULOS REGISTRADOS', value: '❌ Sin vehículos' });
    }

    // Arrestos
    if (info.arrestos.length > 0) {
        const arrestosText = info.arrestos.slice(0, 3).map(a => 
            `• **${a.nombre_ic}** - ${a.articulos} (${new Date(a.fecha).toLocaleDateString()})`
        ).join('\n');
        embed.addFields({ name: `🚔 HISTORIAL DE ARRESTOS (${info.arrestos.length})`, value: arrestosText });
    } else {
        embed.addFields({ name: '🚔 HISTORIAL DE ARRESTOS', value: '✅ Sin arrestos' });
    }

    // Sanciones
    if (info.sanciones.length > 0) {
        const sancionesText = info.sanciones.slice(0, 3).map(s => 
            `• **${s.tipo}** - ${s.razon}`
        ).join('\n');
        embed.addFields({ name: `⚖️ SANCIONES ACTIVAS (${info.sanciones.length})`, value: sancionesText });
    } else {
        embed.addFields({ name: '⚖️ SANCIONES ACTIVAS', value: '✅ Sin sanciones' });
    }

    // Incautaciones
    if (info.incautaciones.length > 0) {
        const incautacionesText = info.incautaciones.slice(0, 3).map(i => 
            `• **${i.tipo}** - ${i.detalle} (${new Date(i.fecha).toLocaleDateString()})`
        ).join('\n');
        embed.addFields({ name: `🔒 INCAUTACIONES (${info.incautaciones.length})`, value: incautacionesText });
    }

    await interaction.editReply({ embeds: [embed] });
}

// Manejador de botones de votación
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'votar_si' || interaction.customId === 'votar_no') {
        await interaction.reply({ content: `✅ Voto registrado: ${interaction.customId === 'votar_si' ? 'A FAVOR' : 'EN CONTRA'}`, ephemeral: true });
    }

    // Manejador de botones de sanciones
    if (interaction.customId.startsWith('sancion_')) {
        const [, tipo, userId] = interaction.customId.split('_');
        
        const modal = new ModalBuilder()
            .setCustomId(`modal_sancion_${tipo}_${userId}`)
            .setTitle(`Aplicar ${tipo}`);

        const razonInput = new TextInputBuilder()
            .setCustomId('razon')
            .setLabel('Razón de la sanción')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(razonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
});

// Manejador de modales
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('modal_sancion_')) {
        const [, , tipo, userId] = interaction.customId.split('_');
        const razon = interaction.fields.getTextInputValue('razon');

        db.run(
            'INSERT INTO sanciones (user_id, tipo, razon, staff_id) VALUES (?, ?, ?, ?)',
            [userId, tipo, razon, interaction.user.id],
            (err) => {
                if (err) {
                    return interaction.reply({ content: '❌ Error al registrar sanción.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle('⚖️ SANCIÓN APLICADA')
                    .addFields(
                        { name: '👤 Usuario', value: `<@${userId}>`, inline: true },
                        { name: '📋 Tipo', value: tipo, inline: true },
                        { name: '👮 Staff', value: `${interaction.user}`, inline: true },
                        { name: '📝 Razón', value: razon }
                    )
                    .setFooter({ text: 'Antioquia RP' })
                    .setTimestamp();

                interaction.reply({ embeds: [embed] });
            }
        );
    }
});

// Iniciar el bot
client.login(process.env.DISCORD_TOKEN);