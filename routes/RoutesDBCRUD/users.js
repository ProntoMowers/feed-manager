const express = require("express");
const { authenticateToken } = require("../../middleware/index");
const { insertIntoTable,
    updateTable,
    fetchDataFromTable,
    deleteFromTable,
    fetchOneFromTable,
    updateUserCompany,
    insertIntoTableMultiple,
    fetchAllFromTableByUserId,
    deleteFromTableMultiple } = require("../../databases/CRUD");
const routerUsers = express.Router();
const bcrypt = require('bcrypt');

routerUsers.get("/users/getUsers", authenticateToken, async (req, res) => {
    try {
        const users = await fetchDataFromTable('users');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ message: "Error al obtener los usuarios" });
    }
});

routerUsers.post("/users/createUser", authenticateToken, async (req, res) => {
    const userData = req.body;
    const columns = ['company_id', 'username', 'password_hash', 'role_id']; // Asegúrate de que estos campos están presentes en userData

    console.log('Received userData:', userData);

    userData.company_id = parseInt(userData.company_id, 10)

    if (userData.selectedCompanies) {
        userData.selectedCompanies = userData.selectedCompanies.map(companyId => parseInt(companyId, 10));
    }

    if (userData.company_id) {
        userData.company_id = parseInt(userData.company_id, 10);
    }

    // Guardar las compañías seleccionadas en una constante y eliminar del objeto userData
    const selectedCompanies = userData.selectedCompanies;
    delete userData.selectedCompanies;

    try {
        // Primero, insertar el usuario
        const result = await insertIntoTable('users', userData, columns);

        if (result.affectedRows > 0) {
            const userId = result.insertId;

            // Crear las relaciones userCompanies
            const userCompaniesData = selectedCompanies.map(companyId => ({
                user_id: userId,
                company_id: companyId
            }));

            // Insertar las relaciones userCompanies una por una
            let totalAffectedRows = 0;
            for (const userCompany of userCompaniesData) {
                const userCompanyResult = await insertIntoTableMultiple('user_companies', userCompany, ['user_id', 'company_id']);
                totalAffectedRows += userCompanyResult.affectedRows;
            }

            if (totalAffectedRows > 0) {
                res.status(201).json({ message: "Usuario creado con éxito" });
            } else {
                res.status(400).json({ message: "Usuario creado, pero no se pudieron insertar las relaciones User-Company" });
            }
        } else {
            res.status(400).json({ message: "No se pudo insertar el usuario" });
        }
    } catch (error) {
        console.error('Error al insertar usuario y relaciones User-Company:', error);
        res.status(500).json({ message: "Error al crear el usuario y relaciones User-Company" });
    }
});



routerUsers.put("/users/updateUser/:userId", authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const { username, newPassword, primaryCompanyId, roleId } = req.body;
    const userData = req.body;

    // Guardar las compañías seleccionadas en una constante y eliminar del objeto userData
    const selectedCompanies = userData.selectedCompanies;
    delete userData.selectedCompanies;

    // Obtener las relaciones actuales de user_companies
    const userCompanies = await fetchAllFromTableByUserId(userId);

    console.log("User Companies:", userCompanies);
    console.log("Selected Companies:", selectedCompanies);

    try {
        // Obtener el usuario actual de la base de datos
        const user = await fetchOneFromTable('users', userId, 'user_id');
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Preparar los datos para la actualización
        const updateData = {
            username,
            company_id: primaryCompanyId,
            role_id: roleId
        };

        // Si se proporciona una nueva contraseña, encriptarla
        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(newPassword, salt);
        }

        // Actualizar el usuario en la base de datos
        const result = await updateTable('users', updateData, 'user_id', userId);
        if (result.affectedRows > 0) {
            // Eliminar las relaciones actuales en user_companies
            for (const userCompany of userCompanies) {
                const deleteResult = await deleteFromTableMultiple('user_companies', ['user_id', 'company_id'], [userCompany.user_id, userCompany.company_id]);
                if (deleteResult.affectedRows === 0) {
                    console.error(`Error al eliminar user_company: user_id=${userCompany.user_id}, company_id=${userCompany.company_id}`);
                }
            }

            // Insertar las nuevas relaciones user_companies
            const userCompaniesData = selectedCompanies.map(CompanyId => ({
                user_id: userId,
                company_id: CompanyId
            }));

            let totalAffectedRows = 0;
            for (const userCompany of userCompaniesData) {
                
                const userCompanyResult = await insertIntoTableMultiple('user_companies', userCompany, ['user_id', 'company_id']);
                totalAffectedRows += userCompanyResult.affectedRows;
            }

            res.status(200).json({ message: "Usuario actualizado con éxito" });
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
        }
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ message: "Error al actualizar el usuario" });
    }
});



routerUsers.put("/users/updateUserCompany/:userId", authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req.body;

    try {
        const result = await updateUserCompany(userId, companyId);
        if (result.affectedRows > 0) {
            res.status(200).json({ message: "Usuario actualizado con éxito" });
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
        }
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ message: "Error al actualizar el usuario" });
    }
});




routerUsers.delete("/users/deleteUser/:userId", authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await deleteFromTable('users', 'user_id', userId);
        if (result.affectedRows > 0) {
            res.status(200).json({ message: "Usuario eliminado con éxito" });
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
        }
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ message: "Error al eliminar el usuario" });
    }
});


routerUsers.get("/users/getUser/:userId", authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await fetchOneFromTable('users', userId, idColumnName = 'user_id');
        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
        }
    } catch (error) {
        console.error('Error al obtener el usuario:', error);
        res.status(500).json({ message: "Error interno del servidor al intentar obtener el usuario" });
    }
});

module.exports = routerUsers;

