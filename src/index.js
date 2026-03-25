const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

// ── Configuración mejorada ─────────────────────────────────────────────────────
// Habilitar CORS para todas las rutas
app.use(cors());

// AUMENTAR LÍMITE DE PAYLOAD para imágenes grandes (10mb)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/credenciales", express.static(path.join(__dirname, "credenciales")));

// Archivo de usuarios
const filePath = path.join(__dirname, "usuarios.json");

// Crear archivo si no existe
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({ usuarios: [] }, null, 2));
  console.log("📁 Archivo usuarios.json creado");
}

// ── Middleware de logging ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// ── Endpoint: Guardar datos del aspirante ────────────────────────────────────
app.post("/api/guardar-datos", (req, res) => {
  const nuevoUsuario = req.body;

  // Verificar que los datos lleguen
  console.log("📝 Datos recibidos:", {
    nombre: nuevoUsuario.nombre,
    correo: nuevoUsuario.correo,
    carrera: nuevoUsuario.carrera,
    modalidad: nuevoUsuario.modalidad,
  });

  // Validar datos requeridos
  if (!nuevoUsuario.nombre || !nuevoUsuario.correo || !nuevoUsuario.carrera) {
    return res.status(400).json({
      message: "Faltan datos requeridos",
      error: true,
      required: ["nombre", "correo", "carrera"],
    });
  }

  // Validar formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(nuevoUsuario.correo)) {
    return res.status(400).json({
      message: "Formato de correo inválido",
      error: true,
    });
  }

  // Leer el archivo usuarios.json
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error al leer archivo:", err);
      return res.status(500).json({
        message: "Error al leer el archivo",
        error: true,
      });
    }

    let usuariosData;
    try {
      usuariosData = JSON.parse(data);
      // Asegurar que tenga la estructura correcta
      if (!usuariosData.usuarios) {
        usuariosData = { usuarios: [] };
      }
    } catch (parseErr) {
      console.error("❌ Error al parsear JSON:", parseErr);
      usuariosData = { usuarios: [] };
    }

    // Verificar correo duplicado (case insensitive)
    const correoExistente = usuariosData.usuarios.find(
      (usuario) =>
        usuario.correo.toLowerCase() === nuevoUsuario.correo.toLowerCase(),
    );

    if (correoExistente) {
      console.warn(`⚠️ Correo duplicado: ${nuevoUsuario.correo}`);
      return res.status(400).json({
        message: "Este correo ya está registrado",
        error: true,
        usuario_existente: {
          nombre: correoExistente.nombre,
          fecha: correoExistente.fecha_registro,
        },
      });
    }

    // Generar nuevo ID
    const nuevoId =
      usuariosData.usuarios.length > 0
        ? Math.max(...usuariosData.usuarios.map((u) => u.usuario)) + 1
        : 1;

    const usuarioConId = {
      usuario: nuevoId,
      ...nuevoUsuario,
      fecha_registro: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
    };

    usuariosData.usuarios.push(usuarioConId);

    // Guardar en archivo
    fs.writeFile(
      filePath,
      JSON.stringify(usuariosData, null, 2),
      "utf8",
      (err) => {
        if (err) {
          console.error("❌ Error al guardar:", err);
          return res.status(500).json({
            message: "Error al guardar los datos",
            error: true,
          });
        }

        console.log(
          `✅ Usuario guardado: ${usuarioConId.nombre} (ID: ${nuevoId})`,
        );

        res.status(200).json({
          success: true,
          message: "Datos guardados correctamente",
          usuario: usuarioConId,
        });
      },
    );
  });
});

// ── Endpoint: Enviar credencial por correo ────────────────────────────────────
app.post("/api/enviar-correo", (req, res) => {
  const { nombre, correo, asunto, mensaje, imagen } = req.body;

  console.log(`📧 Solicitud de correo para: ${correo}`);
  console.log(`📏 Tamaño de imagen: ${(imagen?.length || 0) / 1024 / 1024} MB`);

  // Validaciones
  if (!correo) {
    return res.status(400).json({ error: "Correo electrónico requerido" });
  }

  if (!imagen) {
    console.error("❌ No se recibió la imagen");
    return res.status(400).json({ error: "No se recibió la imagen" });
  }

  // Configurar transporter para Outlook 365
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // TLS
    auth: {
      user: "soporte_tecnico_diplomados1@aguascalientes.tecnm.mx",
      pass: "Mielsanmarcos24.",
    },
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false, // Evitar problemas de certificado
    },
    // Timeouts aumentados para imágenes grandes
    connectionTimeout: 30000, // 30 segundos
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  // Opciones del correo
  const mailOptions = {
    from: "soporte_tecnico_diplomados1@aguascalientes.tecnm.mx",
    to: correo,
    subject: asunto || "Tu credencial digital – OpenHouseITA",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #3ef0c8, #7c5cfc); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">OpenITA</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Instituto Tecnológico de Aguascalientes</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">¡Hola ${nombre}!</h2>
            <p>${mensaje || "Gracias por tu interés en el Instituto Tecnológico de Aguascalientes."}</p>
            <p>Adjunto encontrarás tu credencial digital de aspirante.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Este es un correo automático, por favor no responder.<br />
              © 2026 Instituto Tecnológico de Aguascalientes
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: "credencial-digital.png",
        content: imagen,
        encoding: "base64",
        contentType: "image/png",
        cid: "credencial", // Content-ID para incrustar en el HTML
      },
    ],
  };

  // Enviar el correo
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("❌ Error al enviar correo:", {
        error: error.toString(),
        code: error.code,
        command: error.command,
        response: error.response,
      });

      return res.status(500).json({
        error: "Error al enviar el correo",
        details: error.toString(),
        code: error.code,
      });
    }

    console.log(`✅ Correo enviado con éxito a ${correo}`);
    console.log(`📨 Message ID: ${info.messageId}`);

    res.status(200).json({
      success: true,
      message: "Correo enviado exitosamente",
      messageId: info.messageId,
      to: correo,
    });
  });
});

// ── Endpoint: Obtener todos los usuarios (solo para admin/debug) ─────────────
app.get("/api/usuarios", (req, res) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error al leer usuarios" });
    }

    try {
      const usuarios = JSON.parse(data);
      res.json(usuarios);
    } catch (e) {
      res.status(500).json({ error: "Error al parsear datos" });
    }
  });
});

// ── Endpoint: Verificar estado del servidor ──────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ── Manejo de errores global ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error global:", err);

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload demasiado grande",
      message: "La imagen es muy grande. Máximo 10MB",
    });
  }

  res.status(500).json({
    error: "Error interno del servidor",
    message: err.message,
  });
});

// En OpenItaApi/index.js - Agregar después de los otros endpoints

// ── Endpoint: Guardar copia de la credencial en el servidor ───────────────────
app.post("/api/guardar-credencial", (req, res) => {
  const { nombre, correo, carrera, modalidad, cardId, imagen } = req.body;

  console.log(`💾 Guardando copia de credencial para: ${nombre}`);

  // Validaciones
  if (!nombre || !correo || !imagen) {
    return res.status(400).json({
      error: "Faltan datos requeridos",
      message: "Nombre, correo e imagen son obligatorios",
    });
  }

  // Crear directorio para credenciales si no existe
  const credencialesDir = path.join(__dirname, "credenciales");
  if (!fs.existsSync(credencialesDir)) {
    fs.mkdirSync(credencialesDir);
    console.log("📁 Directorio de credenciales creado");
  }

  // Crear subdirectorio por carrera
  const carreraDir = path.join(credencialesDir, carrera.replace(/\s+/g, "_"));
  if (!fs.existsSync(carreraDir)) {
    fs.mkdirSync(carreraDir);
  }

  // Generar nombre de archivo único
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${nombre.replace(/\s+/g, "_")}_${cardId}_${timestamp}.png`;
  const filepath = path.join(carreraDir, filename);

  // Eliminar el prefijo base64 y guardar como archivo
  const base64Data = imagen.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  fs.writeFile(filepath, buffer, (err) => {
    if (err) {
      console.error("❌ Error al guardar credencial:", err);
      return res.status(500).json({
        error: "Error al guardar la credencial",
        details: err.message,
      });
    }

    console.log(`✅ Credencial guardada: ${filepath}`);

    // También guardar metadata en un archivo JSON
    const metadataPath = path.join(carreraDir, "metadata.json");
    let metadata = [];

    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, "utf8");
      metadata = JSON.parse(data);
    }

    metadata.push({
      filename,
      nombre,
      correo,
      carrera,
      modalidad,
      cardId,
      fecha: new Date().toISOString(),
      ruta: filepath,
    });

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.status(200).json({
      success: true,
      message: "Credencial guardada exitosamente",
      filename,
      path: filepath,
      timestamp,
    });
  });
});

// ── Endpoint: Obtener lista de credenciales guardadas ────────────────────────
app.get("/api/credenciales/:carrera?", (req, res) => {
  const { carrera } = req.params;
  const credencialesDir = path.join(__dirname, "credenciales");

  if (!fs.existsSync(credencialesDir)) {
    return res.json({ credenciales: [] });
  }

  if (carrera) {
    // Buscar por carrera específica
    const carreraPath = path.join(credencialesDir, carrera);
    if (!fs.existsSync(carreraPath)) {
      return res.json({ credenciales: [] });
    }

    const files = fs.readdirSync(carreraPath).filter((f) => f.endsWith(".png"));
    res.json({
      carrera,
      credenciales: files.map((f) => ({
        filename: f,
        url: `/credenciales/${carrera}/${f}`,
      })),
    });
  } else {
    // Listar todas las carreras y sus credenciales
    const carreras = fs.readdirSync(credencialesDir);
    const result = {};

    carreras.forEach((carr) => {
      const carreraPath = path.join(credencialesDir, carr);
      const files = fs
        .readdirSync(carreraPath)
        .filter((f) => f.endsWith(".png"));
      result[carr] = files.map((f) => ({
        filename: f,
        url: `/credenciales/${carr}/${f}`,
      }));
    });

    res.json(result);
  }
});

// ── Iniciar servidor ─────────────────────────────────────────────────────────
const port = 4300;
app.listen(port, () => {
  console.log(`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Servidor OpenITA API corriendo exitosamente
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📡 Puerto:         ${port}
  📁 Archivo datos:  ${filePath}
  📦 Límite payload: 10MB
  🌐 URL:            http://localhost:${port}
  
  📍 Endpoints disponibles:
     POST   /api/guardar-datos     - Guardar datos del aspirante
     POST   /api/enviar-correo     - Enviar credencial por correo
     GET    /api/usuarios          - Listar todos los usuarios
     GET    /api/health            - Verificar estado del servidor
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Manejar cierre graceful
process.on("SIGINT", () => {
  console.log("\n👋 Cerrando servidor...");
  process.exit(0);
});
