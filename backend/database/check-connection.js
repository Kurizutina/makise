const pool = require('./connection');

(async () => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS databaseName, 1 AS connected');
    console.log(JSON.stringify(rows[0]));
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
