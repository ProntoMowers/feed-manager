const mysql = require('mysql2');
const bcrypt = require('bcrypt');

require('dotenv').config()

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    charset: process.env.DB_CHARSET, // Incluye charset si está en el .env
    connectionLimit: 10 // Opcional, ajusta según tus necesidades
});


async function insertIntoTable(tableName, data, columns) {

    if (tableName === 'users' && data.password_hash && columns.includes('password_hash')) {
        try {
            // Encripta la contraseña antes de insertarla
            const salt = await bcrypt.genSalt(10);
            data.password_hash = await bcrypt.hash(data.password_hash, salt);
        } catch (error) {
            console.error('Error al encriptar la contraseña:', error);
            throw error;
        }
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${tableName}\` (${columns.join(', ')}) VALUES (${placeholders})`;


    try {
        const [result] = await pool.promise().query(sql, Object.values(data));
        console.log(`Número de registros insertados en ${tableName}:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al insertar en la tabla ${tableName}:`, error);
        throw error;
    }
}

async function insertIntoTableMultiple(tableName, data, columns) {
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${tableName}\` (${columns.join(', ')}) VALUES (${placeholders})`;
    try {
        const [result] = await pool.promise().query(sql, Object.values(data));
        console.log(`Número de registros insertados en ${tableName}:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al insertar en la tabla ${tableName}:`, error);
        throw error;
    }
}

async function updateTable(tableName, data, keyColumn, id) {
    const setClauses = Object.keys(data).map(key => `${key} = ?`);
    const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${keyColumn} = ?`;
    try {
        const [result] = await pool.promise().query(sql, [...Object.values(data), id]);
        console.log(`${tableName} actualizado con éxito:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al actualizar ${tableName}:`, error);
        throw error;
    }
}

async function updateUserCompany(userId, companyId) {
    const sql = 'UPDATE `users` SET company_id = ? WHERE user_id = ?';
    try {
        const [result] = await pool.promise().query(sql, [companyId, userId]);
        console.log(`Usuario actualizado con éxito:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al actualizar usuario:`, error);
        throw error;
    }
}


async function updateTableMultiple(tableName, data, keyColumns, ids) {
    if (!Array.isArray(keyColumns) || !Array.isArray(ids) || keyColumns.length !== ids.length) {
        throw new Error("keyColumns and ids must be arrays of the same length");
    }

    const setClauses = Object.keys(data).map(key => `${key} = ?`);
    const whereClauses = keyColumns.map((col, index) => `${col} = ?`).join(" AND ");
    const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${whereClauses}`;

    try {
        const [result] = await pool.promise().query(sql, [...Object.values(data), ...ids]);
        console.log(`${tableName} actualizado con éxito:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al actualizar ${tableName}:`, error);
        throw error;
    }
}


async function fetchDataFromTable(tableName, conditions = '') {
    const sql = `SELECT * FROM \`${tableName}\`${conditions}`;
    try {
        const [results] = await pool.promise().query(sql);
        return results;
    } catch (error) {
        console.error(`Error al obtener datos de ${tableName}:`, error);
        throw error;
    }
}

async function deleteFromTable(tableName, keyColumn, id) {
    const sql = `DELETE FROM \`${tableName}\` WHERE ${keyColumn} = ?`;
    try {
        const [result] = await pool.promise().query(sql, [id]);
        console.log(`${tableName} eliminado con éxito:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al eliminar de ${tableName}:`, error);
        throw error;
    }

}

async function deleteFromTableMultiple(tableName, keyColumns, ids) {
    if (!Array.isArray(keyColumns) || !Array.isArray(ids) || keyColumns.length !== ids.length) {
        throw new Error("keyColumns and ids must be arrays of the same length");
    }

    const conditions = keyColumns.map((col, index) => `${col} = ?`).join(" AND ");
    const sql = `DELETE FROM \`${tableName}\` WHERE ${conditions}`;
    try {
        const [result] = await pool.promise().query(sql, ids);
        console.log(`${tableName} eliminado con éxito:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al eliminar de ${tableName}:`, error);
        throw error;
    }
}


async function fetchOneFromTable(tableName, id, idColumnName = 'id') {
    const sql = `SELECT * FROM \`${tableName}\` WHERE \`${idColumnName}\` = ?`;
    try {
        const [results, fields] = await pool.promise().query(sql, [id]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error(`Error al obtener el registro desde ${tableName}:`, error);
        throw error;
    }
}

async function fetchOneFromTableMultiple(tableName, idColumns, ids) {
    if (!Array.isArray(idColumns) || !Array.isArray(ids) || idColumns.length !== ids.length) {
        throw new Error("idColumns and ids must be arrays of the same length");
    }

    const conditions = idColumns.map((col) => `\`${col}\` = ?`).join(" AND ");
    const sql = `SELECT * FROM \`${tableName}\` WHERE ${conditions}`;
    try {
        const [results, fields] = await pool.promise().query(sql, ids);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error(`Error al obtener el registro desde ${tableName}:`, error);
        throw error;
    }
}

async function fetchAllFromTableByRoleId(roleId) {
    const sql = `SELECT * FROM \`role_modules\` WHERE \`role_id\` = ?`;
    try {
        const [results] = await pool.promise().query(sql, [roleId]);
        return results;
    } catch (error) {
        console.error(`Error al obtener registros de role_modules con role_id = ${roleId}:`, error);
        throw error;
    }
}

async function fetchAllFromTableByUserId(roleId) {
    const sql = `SELECT * FROM \`user_companies\` WHERE \`user_id\` = ?`;
    try {
        const [results] = await pool.promise().query(sql, [roleId]);
        return results;
    } catch (error) {
        console.error(`Error al obtener registros de role_modules con role_id = ${roleId}:`, error);
        throw error;
    }
}

async function fetchAllFromTableUserRolByUserId(roleId) {
    const sql = `SELECT * FROM \`user_roles\` WHERE \`user_id\` = ?`;
    try {
        const [results] = await pool.promise().query(sql, [roleId]);
        return results;
    } catch (error) {
        console.error(`Error al obtener registros de role_modules con role_id = ${roleId}:`, error);
        throw error;
    }
}


async function updateFeed(feedId, updateData) {
    try {
        const result = await updateTable('feeds', updateData, 'feed_id', feedId);
        console.log('Resultado de la consulta:', result); // Registro del resultado de la consulta
        return result.affectedRows > 0 ? { success: true, message: "Feed actualizado con éxito" } : { success: false, message: "Feed no encontrado" };
    } catch (error) {
        console.error('Error al actualizar feed:', error);
        throw new Error("Error al actualizar el feed");
    }
}



async function insertEncryptedFeed(feedName, storeHash, authToken) {
    const sql = `CALL insert_encrypted_feed(?, ?, ?);`;

    try {
        const [result] = await pool.promise().query(sql, [feedName, storeHash, authToken]);
        console.log(`Número de registros insertados en feeds_test:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al insertar en la tabla feeds_test:`, error);
        throw error;
    }
}

async function fetchDecryptedFeeds() {
    const sql = `CALL select_decrypted_feeds();`;
    try {
        const [results] = await pool.promise().query(sql);
        return results[0]; // Asegúrate de retornar el primer conjunto de resultados
    } catch (error) {
        console.error(`Error al obtener los datos desencriptados:`, error);
        throw error;
    }
}

// Función temporal para insertar datos y consultar el registro insertado
async function testInsertAndFetchFeedTest() {
    try {
        // Insertar datos encriptados
        await insertEncryptedFeed('Test Feed', 'storehashvalue', 'auth_token_value');
        
        // Consultar los datos desencriptados
        const fetchedData = await fetchDecryptedFeeds();
        console.log('Datos consultados:', fetchedData);

        return fetchedData;
    } catch (error) {
        console.error('Error en testInsertAndFetchFeedTest:', error);
        throw error;
    }
}


async function fetchFeedByStoreHash(store_hash) {
    const tableName = 'feeds';
    const columnName = 'store_hash';
    
    const sql = `SELECT * FROM \`${tableName}\` WHERE \`${columnName}\` = ?`;
    try {
        const [results, fields] = await pool.promise().query(sql, [store_hash]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error(`Error al obtener el registro desde ${tableName}:`, error);
        throw error;
    }
}

// Función para guardar el checkpoint
async function saveCheckpoint(feedId, storeHash, currentPage, currentUrl, totalValidCount, isCompleted = false) {
    const sql = 'REPLACE INTO `feed_checkpoints` (feed_id, store_hash, current_page, current_url, total_valid_count, is_completed) VALUES (?, ?, ?, ?, ?, ?)';
    try {
        const [result] = await pool.promise().query(sql, [feedId, storeHash, currentPage, currentUrl, totalValidCount, isCompleted]);
        console.log(`Checkpoint guardado con éxito para store_hash ${storeHash}, url ${currentUrl}, completado: ${isCompleted}:`, result.affectedRows);
        return result;
    } catch (error) {
        console.error(`Error al guardar checkpoint para store_hash ${storeHash}, url ${currentUrl}:`, error);
        throw error;
    }
}


// Función para obtener el checkpoint
// Obtener el checkpoint
async function getCheckpoint(storeHash, currentUrl) {
    const sql = 'SELECT current_page, total_valid_count, is_completed FROM `feed_checkpoints` WHERE store_hash = ? AND current_url = ?';
    try {
        const [results] = await pool.promise().query(sql, [storeHash, currentUrl]);
        if (results.length > 0) {
            return {
                currentPage: results[0].current_page,
                totalValidCount: results[0].total_valid_count,
                isCompleted: results[0].is_completed
            };
        } else {
            return {
                currentPage: 1,
                totalValidCount: 0,
                isCompleted: false
            };
        }
    } catch (error) {
        console.error(`Error al obtener checkpoint para store_hash ${storeHash}, url ${currentUrl}:`, error);
        throw error;
    }
}



// Obtener todas las URLs asociadas a un feed
async function getUrlsForFeed(feedId) {
    const sql = 'SELECT DISTINCT current_url FROM `feed_checkpoints` WHERE feed_id = ?';
    try {
        const [results] = await pool.promise().query(sql, [feedId]);
        return results.map(row => row.current_url);
    } catch (error) {
        console.error(`Error al obtener URLs para feed_id ${feedId}:`, error);
        throw error;
    }
}

// Verificar si todas las URLs están completadas
async function areAllUrlsCompleted(feedId) {
    const sql = 'SELECT current_url, is_completed FROM `feed_checkpoints` WHERE feed_id = ?';
    try {
        const [results] = await pool.promise().query(sql, [feedId]);
        const urlCompletionMap = results.reduce((map, row) => {
            map[row.current_url] = row.is_completed;
            return map;
        }, {});
        
        return Object.values(urlCompletionMap).every(isCompleted => isCompleted);
    } catch (error) {
        console.error(`Error al verificar completitud de URLs para feed_id ${feedId}:`, error);
        throw error;
    }
}

// Reiniciar checkpoints para todas las URLs de un feed
async function resetAllCheckpoints(feedId) {
    const sql = 'UPDATE `feed_checkpoints` SET current_page = 1, is_completed = FALSE WHERE feed_id = ?';
    try {
        const [result] = await pool.promise().query(sql, [feedId]);
        console.log(`Checkpoints reseteados a 1 para feed_id ${feedId}`);
        return result;
    } catch (error) {
        console.error(`Error al resetear checkpoints para feed_id ${feedId}:`, error);
        throw error;
    }
}

async function checkAndResetCheckpoints(feedId) {
    const allCompleted = await areAllUrlsCompleted(feedId);
    if (allCompleted) {
        await resetAllCheckpoints(feedId);
    }
}



module.exports = {
    insertIntoTable,
    updateTable,
    fetchDataFromTable,
    deleteFromTable,
    fetchOneFromTable,
    deleteFromTableMultiple,
    updateTableMultiple,
    insertIntoTableMultiple,
    fetchOneFromTableMultiple,
    fetchAllFromTableByRoleId,
    updateFeed,
    testInsertAndFetchFeedTest,
    fetchAllFromTableByUserId,
    updateUserCompany,
    fetchAllFromTableUserRolByUserId,
    fetchFeedByStoreHash,
    getCheckpoint,
    saveCheckpoint,getUrlsForFeed, areAllUrlsCompleted, resetAllCheckpoints,
    checkAndResetCheckpoints
};
