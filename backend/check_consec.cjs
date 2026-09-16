const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', port: 5432, database: 'BrainCare', user: 'postgres', password: 'N@zim2002' });

const sql = `
SELECT p.id, p.first_name, p.last_name, a.status, a.start_time,
       ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY a.start_time DESC) AS rn
FROM patients p
JOIN appointment_patients ap ON ap.patient_id = p.id
JOIN appointments a ON a.id = ap.appointment_id
ORDER BY p.first_name, a.start_time DESC
`;

p.query(sql).then(r => {
  // Group by patient
  const byPatient = {};
  for (const row of r.rows) {
    const key = row.first_name + ' ' + row.last_name;
    if (!byPatient[key]) byPatient[key] = [];
    byPatient[key].push(row);
  }
  for (const [name, rows] of Object.entries(byPatient)) {
    let consec = 0;
    for (const row of rows) {
      if (row.status === 'cancelled') {
        consec++;
      } else {
        break;
      }
    }
    if (consec >= 2) {
      console.log(`\n${name}: consecutiveNoShows = ${consec} -> ${consec >= 3 ? 'RED' : 'ORANGE'}`);
      for (const row of rows) {
        console.log(`  rn=${row.rn} ${row.status} ${new Date(row.start_time).toISOString()}`);
      }
    }
  }
  p.end();
}).catch(e => {
  console.error(e);
  p.end();
});
