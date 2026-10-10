const db = require('../../config/database');

const STAFF_COLUMNS = 'id, name, role, is_active AS isActive, created_at AS createdAt';

// A null `active` matches everyone.
const findAll = async ({ active = null } = {}) => {
  const [rows] = await db.query(
    `SELECT ${STAFF_COLUMNS}
       FROM staff
      WHERE (? IS NULL OR is_active = ?)
      ORDER BY name`,
    [active, active]
  );
  return rows;
};

const findById = async (id, connection = db) => {
  const [rows] = await connection.query(`SELECT ${STAFF_COLUMNS} FROM staff WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const findByName = async (name) => {
  const [rows] = await db.query(`SELECT ${STAFF_COLUMNS} FROM staff WHERE name = ?`, [name]);
  return rows[0] ?? null;
};

const create = async ({ name, role }) => {
  const [result] = await db.query('INSERT INTO staff (name, role) VALUES (?, ?)', [name, role]);
  return result.insertId;
};

// Only the given fields change; undefined means "keep".
const update = async (id, { name, role, isActive }) => {
  await db.query(
    `UPDATE staff
        SET name = COALESCE(?, name),
            role = COALESCE(?, role),
            is_active = COALESCE(?, is_active)
      WHERE id = ?`,
    [name ?? null, role ?? null, isActive ?? null, id]
  );
};

module.exports = { findAll, findById, findByName, create, update };
