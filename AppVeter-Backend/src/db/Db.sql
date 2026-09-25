USE appveter;

 CREATE TABLE IF NOT EXISTS users(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(90) NOT NULL UNIQUE,
  email VARCHAR(180) NOT NULL UNIQUE,
  cedula VARCHAR(90) NULL UNIQUE,
  name VARCHAR(90) NOT NULL,
  lastname VARCHAR(90) NOT NULL,
  phone VARCHAR(90) NOT NULL UNIQUE,
   image VARCHAR(255) NULL,
   password VARCHAR(90) NOT NULL,
   direccion TEXT NULL,
   reset_code VARCHAR(8) NULL,
   reset_code_expires DATETIME NULL,
   reset_code_attempts INT NOT NULL DEFAULT 0,
   created_at DATETIME NOT NULL,
   updated_at DATETIME NOT NULL
  );

 CREATE TABLE IF NOT EXISTS roles(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(90) NOT NULL UNIQUE,
  image VARCHAR(255) NULL,
  route VARCHAR(180) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
 );

 INSERT IGNORE INTO roles(id, name, route, created_at, updated_at) VALUES 
 (1, 'ADMINISTRADOR', '/admin/home', NOW(), NOW()),
 (2, 'RECEPCIONISTA', '/reception/home', NOW(), NOW()),
 (3, 'CLIENTE', '/client/home', NOW(), NOW()),
 (4, 'VETERINARIO', '/veterinary/home', NOW(), NOW());

 CREATE TABLE IF NOT EXISTS user_has_roles(
  id_user BIGINT NOT NULL,
  id_rol BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(id_user) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY(id_rol) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY(id_user, id_rol)
 );

 CREATE TABLE IF NOT EXISTS clients(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre_propietario VARCHAR(255) NOT NULL,
  ci VARCHAR(50) NOT NULL UNIQUE,
  direccion TEXT NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  fecha DATE NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
 );

 CREATE TABLE IF NOT EXISTS doctors(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
 );

 INSERT IGNORE INTO doctors(id, nombre, created_at, updated_at) VALUES 
 (1, 'Johanna', NOW(), NOW()),
 (2, 'Alejandro', NOW(), NOW()),
 (3, 'Mariana', NOW(), NOW());

 CREATE TABLE IF NOT EXISTS mascotas(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  client_id BIGINT NOT NULL,
  doctor_nombre VARCHAR(255) NULL,
  nombre_mascota VARCHAR(255) NOT NULL,
  especie VARCHAR(100) NOT NULL,
  raza VARCHAR(100) NOT NULL,
  edad VARCHAR(50) NOT NULL,
  sexo VARCHAR(20) NOT NULL,
  dieta VARCHAR(255) NOT NULL,
  peso VARCHAR(50) NOT NULL,
  microchip VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE CASCADE
 );

 CREATE TABLE IF NOT EXISTS mascota_estado(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mascota_id BIGINT NOT NULL,
  comportamiento VARCHAR(255) NULL,
  apetito VARCHAR(255) NULL,
  defecacion VARCHAR(255) NULL,
  diarrea VARCHAR(255) NULL,
  prenez VARCHAR(255) NULL,
  cirugia VARCHAR(255) NULL,
  inmunizaciones VARCHAR(255) NULL,
  desparasitacion VARCHAR(255) NULL,
  ingesta_agua VARCHAR(255) NULL,
  miccion VARCHAR(255) NULL,
  vomitos VARCHAR(255) NULL,
  celos VARCHAR(255) NULL,
  partos VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(mascota_id) REFERENCES mascotas(id) ON UPDATE CASCADE ON DELETE CASCADE
 );

 CREATE TABLE IF NOT EXISTS mascota_examen_fisico(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mascota_id BIGINT NOT NULL,
  temperatura VARCHAR(50) NULL,
  campo_pulmonar VARCHAR(255) NULL,
  tiempo_perfusion_capilar VARCHAR(255) NULL,
  membrana_mucosa VARCHAR(255) NULL,
  frecuencia_cardiaca VARCHAR(50) NULL,
  reflejo_deglutorio VARCHAR(255) NULL,
  frecuencia_pulso VARCHAR(50) NULL,
  reflejo_tusigeno VARCHAR(255) NULL,
  frecuencia_respiratoria VARCHAR(50) NULL,
  palpacion_abdominal VARCHAR(255) NULL,
  nodulos_linfaticos VARCHAR(255) NULL,
  antecedentes_clinicos TEXT NULL,
  observaciones TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(mascota_id) REFERENCES mascotas(id) ON UPDATE CASCADE ON DELETE CASCADE
 );

 CREATE TABLE IF NOT EXISTS mascota_examenes_paraclinicos(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mascota_id BIGINT NOT NULL,
  perfil_quimico TINYINT(1) DEFAULT 0,
  hematologia TINYINT(1) DEFAULT 0,
  coprologia TINYINT(1) DEFAULT 0,
  uroanalisis TINYINT(1) DEFAULT 0,
  hemoparasitos TINYINT(1) DEFAULT 0,
  otro TINYINT(1) DEFAULT 0,
  diagnostico_presuntivo TEXT NULL,
  tratamiento TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(mascota_id) REFERENCES mascotas(id) ON UPDATE CASCADE ON DELETE CASCADE
 );

  CREATE TABLE IF NOT EXISTS citas(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  nombre_propietario VARCHAR(255) NOT NULL,
  ci VARCHAR(50) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  direccion TEXT NOT NULL,
  correo_electronico VARCHAR(180) NOT NULL,
  motivo_cita TEXT NOT NULL,
  estado VARCHAR(50) DEFAULT 'PENDIENTE',
  fecha_solicitud DATETIME NOT NULL,
  fecha_cita DATE NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
 );

   CREATE TABLE IF NOT EXISTS novedades(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  descripcion TEXT NOT NULL,
  image VARCHAR(255) NULL,
  user_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS services(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  image VARCHAR(255) NULL,
  user_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS notificaciones(
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  leida TINYINT(1) DEFAULT 0,
  cita_id BIGINT NULL,
  emisor_id BIGINT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY(cita_id) REFERENCES citas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY(emisor_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_reset_code_expires ON users(reset_code_expires);
CREATE INDEX IF NOT EXISTS idx_citas_user_id ON citas(user_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_cita ON citas(fecha_cita);
CREATE INDEX IF NOT EXISTS idx_mascotas_client_id ON mascotas(client_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_id ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones(created_at);
CREATE INDEX IF NOT EXISTS idx_novedades_user_id ON novedades(user_id);
CREATE INDEX IF NOT EXISTS idx_novedades_created_at ON novedades(created_at);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_user_has_roles_id_rol ON user_has_roles(id_rol);
CREATE INDEX IF NOT EXISTS idx_mascota_estado_mascota_id ON mascota_estado(mascota_id);
CREATE INDEX IF NOT EXISTS idx_mascota_examen_fisico_mascota_id ON mascota_examen_fisico(mascota_id);
CREATE INDEX IF NOT EXISTS idx_mascota_examenes_paraclinicos_mascota_id ON mascota_examenes_paraclinicos(mascota_id);
