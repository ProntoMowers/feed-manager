const pm2 = require('pm2');
const { fetchDataFromTable, updateFeed } = require("./databases/CRUD");
const { listAllProducts } = require("./api/googleMerchantAPI");

const startHourSmallFeeds = 1; // Empezamos a las 1 AM para los feeds pequeños de lunes a viernes
const startHourLargeFeeds = 1; // Empezamos a las 1 AM para los feeds grandes el sábado
const startHourVeryLargeFeeds = 1; // Empezamos a las 1 AM para los feeds muy grandes el domingo

// Configuración de intervalos de tiempo
const intervalHoursSmallFeeds = 1; // Intervalo de 1 hora entre cada feed pequeño
const intervalHoursLargeFeeds = 3; // Intervalo de 3 horas entre cada feed grande
const intervalHoursVeryLargeFeeds = 3; // Intervalo de 3 horas entre cada feed muy grande

function estimateExecutionTime(productsCount, productsPerBatch = 15, timePerBatchSeconds = 148.288) {
  const totalBatches = Math.ceil(productsCount / productsPerBatch);
  return totalBatches * timePerBatchSeconds; // Tiempo en segundos
}

function generateCronPattern(day, hour) {
  return `0 ${hour % 24} * * ${day}`;
}

async function createCronJobsForFeeds() {
  console.log("Inicio del proceso de configuración de cron jobs para los feeds");
  const currentDateTime = new Date();
  console.log("Fecha y hora de ejecución:", currentDateTime.toISOString());

  try {
    const feeds = await fetchDataFromTable("feeds");

    let currentHourSmallFeeds = startHourSmallFeeds;
    let currentHourLargeFeeds = startHourLargeFeeds;
    let currentHourVeryLargeFeeds = startHourVeryLargeFeeds;

    for (const feed of feeds) {
      const productsCount = feed.total_products_bc;
      const estimatedTimeSeconds = estimateExecutionTime(productsCount);

      let cronDay, currentHour, intervalHours, scheduleMessage;

      if (productsCount > 500000) { // Muy grande
        cronDay = 0; // Domingo
        currentHour = currentHourVeryLargeFeeds;
        intervalHours = intervalHoursVeryLargeFeeds;
        scheduleMessage = `El feed #${feed.feed_id} (${feed.feed_name}) se ejecutará los domingos a la(s) ${currentHour}:00 AM`;
        currentHourVeryLargeFeeds += intervalHours;
      } else if (productsCount > 100000) { // Grande
        cronDay = 6; // Sábado
        currentHour = currentHourLargeFeeds;
        intervalHours = intervalHoursLargeFeeds;
        scheduleMessage = `El feed #${feed.feed_id} (${feed.feed_name}) se ejecutará los sábados a la(s) ${currentHour}:00 AM`;
        currentHourLargeFeeds += intervalHours;
      } else { // Pequeño
        cronDay = '1-5'; // Lunes a viernes
        currentHour = currentHourSmallFeeds;
        intervalHours = intervalHoursSmallFeeds;
        scheduleMessage = `El feed #${feed.feed_id} (${feed.feed_name}) se ejecutará de lunes a viernes a la(s) ${currentHour}:00 AM`;
        currentHourSmallFeeds += intervalHours;
      }

      const cronPattern = generateCronPattern(cronDay, currentHour);
      console.log(scheduleMessage); // Imprime el mensaje de programación

      await createOrUpdateCronJob(feed.feed_id, cronPattern);
    }

    console.log("Todos los trabajos cron se han configurado correctamente.");
  } catch (error) {
    console.error("Error durante el proceso de configuración de cron jobs:", error);
  }
}

async function createOrUpdateCronJob(feedId, cronPattern) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) return reject(err);

      pm2.describe(`cron-task-${feedId}`, (err, processDescription) => {
        if (err) {
          pm2.disconnect();
          return reject(err);
        }

        if (processDescription && processDescription.length > 0) {
          // Si el proceso existe, lo eliminamos primero
          pm2.delete(`cron-task-${feedId}`, (err) => {
            if (err && err.message !== 'Process or namespace not found') {
              pm2.disconnect();
              return reject(err);
            }
            startNewCronJob(); // Llamamos a la función para crear un nuevo cron job
          });
        } else {
          startNewCronJob(); // Creamos el cron job si no existe
        }
      });

      function startNewCronJob() {
        pm2.start({
          script: 'cron-task.js',
          name: `cron-task-${feedId}`,
          cron: cronPattern,
          args: [feedId],
          autorestart: false
        }, (err, apps) => {
          pm2.disconnect();
          if (err) return reject(err);
          resolve(`Trabajo cron creado/actualizado exitosamente para feedId: ${feedId} con expresión cron: ${cronPattern}`);
        });
      }
    });
  });
}

// Ejecuta la creación de cron jobs
createCronJobsForFeeds().then(() => {
  console.log('Proceso de creación de trabajos cron completado.');
}).catch((err) => {
  console.error('Error al crear los trabajos cron:', err);
});
