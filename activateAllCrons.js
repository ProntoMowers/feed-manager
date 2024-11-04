const pm2 = require('pm2');
const { fetchDataFromTable, updateFeed } = require("./databases/CRUD");
const { listAllProducts } = require("./api/googleMerchantAPI");

// Configuración de las horas para los feeds
const startHour = 1; // Empezamos a las 1 AM
const intervalHours = 1; // Intervalo de 1 hora entre cada feed

// Función para calcular el tiempo de ejecución estimado basado en el número de productos
function estimateExecutionTime(productsCount, productsPerPage = 15, timePer15PagesSeconds = 2 * 60 + 28.288) {
    const totalPages = Math.ceil(productsCount / productsPerPage);
    const totalBatches = Math.ceil(totalPages / 15);  // Calcula el número de lotes de 15 páginas
    return totalBatches * timePer15PagesSeconds;
}

// Función para generar una expresión cron basada en el día, la hora y el intervalo
function generateCronPattern(day, hour) {
  return `0 ${hour} * * ${day}`;
}

// Función principal para crear y programar los cron jobs
async function createCronJobsForFeeds() {
  console.log("Inicio del proceso de configuración de cron jobs para los feeds");
  const currentDateTime = new Date();
  console.log("Fecha y hora de ejecución:", currentDateTime.toISOString());

  try {
    // Obtener todos los feeds de la tabla
    const feeds = await fetchDataFromTable("feeds");
    //console.log("Feeds obtenidos:", feeds);

    let currentHour = startHour;

    for (const feed of feeds) {
        //console.log("Leyendo el feed #: ",feed)
      const productsCount = feed.total_products_bc;
      const estimatedTimeSeconds = estimateExecutionTime(productsCount);
      const isLargeFeed = estimatedTimeSeconds > 1800; // Más de 30 minutos

      let cronDay;
      let scheduleMessage; // Variable para almacenar el mensaje de programación

      if (isLargeFeed) {
        // Feeds grandes programados en fines de semana
        cronDay = productsCount > 500000 ? 0 : 6; // Domingo para los feeds enormes, Sábado para los grandes
        currentHour = 1; // Siempre empezamos a la 1 AM en fines de semana para feeds grandes
        scheduleMessage = `El feed #${feed.feed_id} (${feed.feed_name}) se ejecutará los ${cronDay === 0 ? 'domingos' : 'sábados'} a la(s) ${currentHour}:00 AM`;
      } else {
        // Feeds pequeños programados de lunes a viernes en intervalos de una hora
        cronDay = '1-5'; // Lunes a viernes
        scheduleMessage = `El feed #${feed.feed_id} (${feed.feed_name}) se ejecutará de lunes a viernes a la(s) ${currentHour}:00 AM`;
      }

      const cronPattern = generateCronPattern(cronDay, currentHour % 24);
      console.log(scheduleMessage); // Imprime el mensaje de programación

      await createCronJob(feed.id, currentHour, cronPattern);
      
      // Incrementar la hora para el próximo feed si es entre semana
      if (!isLargeFeed) {
        currentHour += intervalHours;
      }
    }

    console.log("Todos los trabajos cron se han configurado correctamente.");

  } catch (error) {
    console.error("Error durante el proceso de configuración de cron jobs:", error);
  }
}

// Función para crear el trabajo cron usando pm2
async function createCronJob(feedId, hour, cronPattern) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) return reject(err);

      pm2.start({
        script: 'cron-task.js',
        name: `cron-task-${feedId}`,
        args: [feedId],
        cron: cronPattern,
        autorestart: false,
      }, (err, apps) => {
        pm2.disconnect();
        if (err) return reject(err);
        resolve(`Trabajo cron creado para feed ${feedId} a las ${hour} con patrón ${cronPattern}`);
      });
    });
  });
}

// Ejecutar la función principal para crear trabajos cron para todos los feeds
createCronJobsForFeeds().then(() => {
  console.log('Proceso de creación de trabajos cron completado.');
}).catch((err) => {
  console.error('Error al crear los trabajos cron:', err);
});
