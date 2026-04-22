const mysql = require('mysql');
require('dotenv').config();

const dbConnection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: process.env.DB_CHARSET,
  connectTimeout: 20000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Intenta conectar
dbConnection.getConnection((error, connection) => {
  if (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error conectando a la base de datos: ', error);
  } else {
    console.log('\x1b[32m%s\x1b[0m', 'Conexión establecida exitosamente con la base de datos');
    connection.release();
  }
});

module.exports = {
    dbConnection
}
  