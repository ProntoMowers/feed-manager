const fetch = require('node-fetch');
const crypto = require('crypto');
const cron = require('node-cron');


async function transformProduct(config, bcProduct) {
  const { getProductImages } = require("../api/imagesBigCommerceApi");
  const { fetchCategoryNameById, getStoreDomain , buildCategoryTrees } = require("../api/categoriesBigCommerceApi");
  const { getBrandNameById } = require("../api/productsBigCommerceApi");

  const { primerImagen, ImagenesRestantes } = await getProductImages(config, bcProduct.id);
  //const domain = getStoreDomain(config);

  //console.log("Dominio: ", config.domain)

  // Configura aquí las propiedades que son comunes entre BigCommerce y Google Merchant Center
  const googleProductFormat = {
    offerId: bcProduct.sku,
    title: bcProduct.name,
    description: bcProduct.description, //.replace(/<[^>]*>?/gm, ""), // Eliminar etiquetas HTML
    imageLink: `<g:image_link>${primerImagen.url_standard}</g:image_link>`,
    contentLanguage: "en",
    targetCountry: "us",
    link: `${config.domain}${bcProduct.custom_url.url}`,
    channel: "online",
    googleProductCategory: 'Home & Garden', // Ejemplo, debería ser específico para tu producto
    condition: bcProduct.condition,
    availability: "in_stock",
    customLabel0: bcProduct.inventory_level.toString(),
    price: {
      value: bcProduct.price || bcProduct.calculated_price,
      currency: "USD",
    },
    // Agrega más campos según corresponda...
    // A continuación, se muestran algunos campos adicionales que podrías querer mapear:
    //brand: "Home & Garden",
    mpn: bcProduct.mpn,

  };

  if (bcProduct.categories.length > 0) {
    //console.log("ID de la categoria: ", bcProduct.categories[0]);
    //console.log("Type of ID de la categoria: ", bcProduct.categories[0]);
    const Category = await buildCategoryTrees(
      config,  bcProduct.categories
    );
    googleProductFormat.productTypes = Category;
  }

  if (bcProduct.gtin !== "") {
    googleProductFormat.gtin = bcProduct.gtin
  }

  if (bcProduct.brand_id) {
    //console.log("ID de la categoria: ", bcProduct.categories[0])

    try {
      const Category = await getBrandNameById(config, bcProduct.brand_id);
      if (Category) {
        googleProductFormat.brand = Category
      }
    } catch (error) {
      console.error('Error fetching category:', error);
    }
  }

  if (bcProduct.fixed_cost_shipping_price > 0 && !bcProduct.is_free_shipping) {
    googleProductFormat.shipping = [{
      country: "US",
      service: "Standard shipping",
      price: {
        currency: "USD",
        value: bcProduct.fixed_cost_shipping_price.toString(),
      },
    }];
  }

  if (bcProduct.is_free_shipping) {
    googleProductFormat.shipping = [{
      country: "US",
      service: "Standard shipping",
      price: {
        currency: "USD",
        value: "0.00",
      }
    }];
  }

  // Manejo de imágenes adicionales
  if (ImagenesRestantes && ImagenesRestantes.length > 0) {
    googleProductFormat.additional_image_links = ImagenesRestantes.map(img => `<g:image_link>${img.url_standard}</g:image_link>`);
  }

  // Calcula la fecha de hoy y agrega 21 días

  const today = new Date();
  today.setDate(today.getDate() + 21);
  const availabilityDate = today.toISOString().slice(0, 19) + '+00:00'; // Formato ISO 8601 con desplazamiento de zona horaria

  if (bcProduct.availability === "preorder") {
    googleProductFormat.availability = "preorder";

    googleProductFormat.availability_date = availabilityDate;
  } else if (bcProduct.availability === "disabled") {
    googleProductFormat.availability = "out_of_stock"
  }

  return googleProductFormat;
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const formatPriceForGoogleMerchant = (price) => {
  return {
    value: price.toFixed(2), // Asegura que el precio tenga dos decimales
    currency: 'USD' // Ajusta la moneda según sea necesario
  };
};

async function fetchWithRetry(url, options, retries = 3, backoff = 2000) { //800 bien hasta 6 1200 con 8 //1500 Para El 2
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0) {
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2); // Incrementa el tiempo de espera
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}



function generateHash(data) {
  const hash = crypto.createHash('sha1');
  hash.update(JSON.stringify(data));  // Convierte los datos a una cadena JSON y actualiza el hash con ella
  return hash.digest('hex');  // Devuelve el hash en formato hexadecimal
}

const algorithm = 'aes-256-cbc';  // Puedes elegir otro algoritmo
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function cleanPrivateKey(privateKey) {
  return privateKey.replace(/\\n/g, '\n').trim();
}


function encrypt(text) {
  text = text.replace(/\\n/g, '\n');
  console.log('Texto a encriptar:', text);
  let cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  console.log('Texto encriptado:', encrypted);
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decrypt(text) {
  if (!text || !text.iv || !text.encryptedData) {
    throw new Error("Invalid encrypted data format");
  }
  let iv = Buffer.from(text.iv, 'hex');
  let encryptedText = Buffer.from(text.encryptedData, 'hex');
  let decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  console.log('Texto desencriptado:', decrypted);
  return decrypted;
}

function logMemoryUsage(label) {
  const memoryUsage = process.memoryUsage();
  console.log(`${label} - Memory Usage: RSS: ${memoryUsage.rss / 1024 / 1024} MB, Heap Total: ${memoryUsage.heapTotal / 1024 / 1024} MB, Heap Used: ${memoryUsage.heapUsed / 1024 / 1024} MB, External: ${memoryUsage.external / 1024 / 1024} MB`);
}



async function generateCronPattern(configCron) {
  const { selectedDays, intervalHour, isActive } = configCron;

  console.log("selectedDays: ", selectedDays);
  console.log("intervalHour: ", intervalHour);
  console.log("isActive: ", isActive);

  const dayMap = {
    'monday': '1',
    'tuesday': '2',
    'wednesday': '3',
    'thursday': '4',
    'friday': '5',
    'saturday': '6',
    'sunday': '0'
  };

  // Split the selectedDays string into an array
  const daysArray = selectedDays.split(';').map(day => day.trim());

  // Check if all days are selected
  const allDaysSelected = daysArray.length === 7;

  if (allDaysSelected) {
    return `0 */${intervalHour} * * *`; // Single cron pattern for every hour on all days
  }

  // Generate a single cron expression for all selected days
  const cronDays = daysArray.map(day => dayMap[day.toLowerCase()]).join(',');
  return `0 */${intervalHour} * * ${cronDays}`;
}


const createSimpleCron = async () => {
  const cronExpression = '*/10 * * * * *'; // cada 10 segundos
  let executionCount = 0; // Variable para contar las ejecuciones

  if (cron.validate(cronExpression)) {
    cron.schedule(cronExpression, () => {
      executionCount++; // Incrementar el contador en cada ejecución
      console.log(`Cron job running every 10 seconds. Execution count: ${executionCount}`);
      // Aquí puedes poner el código que deseas que se ejecute cada 10 segundos
    });

    console.log(`Cron job created with expression: ${cronExpression}`);
  } else {
    console.log(`Invalid cron expression: ${cronExpression}`);
  }
};


const pm2 = require('pm2');
// Usar fetchWithRetry en lugar de fetch directamente
async function createCronJob(feedId, configCron) {
  const scriptPath = 'cron-task.js';

  // Asegúrate de que `configCron` tiene los valores correctos
  console.log('configCron:', configCron);

  const cronPattern = await generateCronPattern(configCron);

  // Verifica que `cronPattern` es una cadena válida
  console.log('cronPattern:', cronPattern);

  if (!cronPattern || typeof cronPattern !== 'string') {
    return Promise.reject(new Error('generateCronPattern did not return a valid string'));
  }

  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        return reject(err);
      }

      // Primero, verifica si el trabajo cron existe
      pm2.describe(`cron-task-${feedId}`, (err, processDescription) => {
        if (err) {
          pm2.disconnect();
          return reject(err);
        }

        // Si el proceso existe, elimínalo
        if (processDescription && processDescription.length > 0) {
          pm2.delete(`cron-task-${feedId}`, (err) => {
            if (err && err.message !== 'Process or namespace not found') {
              pm2.disconnect();
              return reject(err);
            }

            // Luego, crea el nuevo trabajo cron
            startNewCronJob();
          });
        } else {
          // Si el proceso no existe, crea el nuevo trabajo cron directamente
          startNewCronJob();
        }
      });

      function startNewCronJob() {
        pm2.start({
          script: scriptPath,
          name: `cron-task-${feedId}`,
          cron: cronPattern,
          args: [feedId],
          autorestart: false
        }, (err, apps) => {
          if (err) {
            pm2.disconnect();
            return reject(err);
          }
          pm2.disconnect();
          resolve(`Trabajo cron creado/actualizado exitosamente para feedId: ${feedId} con expresión cron: ${cronPattern}`);
        });
      }
    });
  });
}


async function buildQueryUrl(baseUrl, expression) {
  if (!expression) {
      throw new Error("La expresión es undefined o null");
  }

  const fields = [
      "type",
      "price",
      "is_featured",
      "availability",
      "is_visible",
      "is_free_shipping",
      "id",
      "weight",
      "condition",
  ];
  const queryParams = [];
  const fieldOccurrences = {};

  const conditions = expression.split(/(AND|OR|\(|\))/).map((cond) => cond.trim()).filter(cond => cond);

  conditions.forEach((condition) => {
      if (condition === "(" || condition === ")" || condition === "AND" || condition === "OR") {
          return;
      } else {
          condition = condition.replace(/[\[\]\(\)]/g, "");
          const [field, operator, value] = condition.split(/\s+/);

          if (fields.includes(field)) {
              if (!fieldOccurrences[field]) {
                  fieldOccurrences[field] = [];
              }
              if (operator === "=") {
                  fieldOccurrences[field].push(`${field}=${value}`);
              } else if (operator === "!=") {
                  fieldOccurrences[field].push(`${field}:not=${value}`);
              } else if ([">", "<", ">=", "<="].includes(operator)) {
                  const opMap = {
                      ">": "greater",
                      "<": "less",
                      ">=": "min",
                      "<=": "max",
                  };
                  fieldOccurrences[field].push(`${field}:${opMap[operator]}=${value}`);
              }
          }
      }
  });

  // Construir URLs
  let urls = [baseUrl];
  Object.entries(fieldOccurrences).forEach(([field, conditions]) => {
      if (conditions.length > 1) {
          // Si hay múltiples valores para un campo, generar múltiples URLs
          const newUrls = [];
          urls.forEach((url) => {
              conditions.forEach((condition) => {
                  newUrls.push(`${url.includes('?') ? url + '&' : url + '?'}${condition}`);
              });
          });
          urls = newUrls;
      } else {
          // Si solo hay un valor, agregarlo a todas las URLs
          urls = urls.map((url) => `${url.includes('?') ? url + '&' : url + '?'}${conditions[0]}`);
      }
  });

  // Llamar a organizeCustomFields (asumiendo que esta función existe y está definida en otra parte)
  const customFieldGroups = organizeCustomFields(expression);

  return {
      url: urls.map(url => url.replace('?&', '?').replace('&&', '&').replace('|&', '|')),
      customFields: customFieldGroups
  };
}



function organizeCustomFields(expression) {
  const customFieldGroups = [];
  let currentCustomGroup = [];
  let lastLogicOperator = "AND";
  let inCustomFieldGroup = false;

  const conditions = expression.split(/(AND|OR|\(|\))/).map((cond) => cond.trim()).filter(cond => cond);

  conditions.forEach((condition, index) => {
    if (condition === "(") {
      inCustomFieldGroup = true;
    } else if (condition === ")") {
      if (currentCustomGroup.length > 0) {
        customFieldGroups.push({
          logic: lastLogicOperator,
          fields: currentCustomGroup
        });
        currentCustomGroup = [];
      }
      inCustomFieldGroup = false;
    } else if (condition === "AND" || condition === "OR") {
      lastLogicOperator = condition;
    } else {
      // Eliminar corchetes
      condition = condition.replace(/\[|\]/g, "");

      const [field, operator, value] = condition.split(/\s+/);
      if (inCustomFieldGroup && field && value) {
        currentCustomGroup.push({ name: field, value: value });
      }
    }
  });

  // Añadir el último grupo si existe
  if (currentCustomGroup.length > 0) {
    customFieldGroups.push({
      logic: lastLogicOperator,
      fields: currentCustomGroup
    });
  }

  return customFieldGroups;
}


async function doesCronJobExist(feedId) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        return reject(err);
      }

      pm2.describe(`cron-task-${feedId}`, (err, processDescription) => {
        pm2.disconnect();
        
        if (err) {
          return reject(err);
        }

        if (processDescription && processDescription.length > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  });
}


async function deleteCronJob(feedId) {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        return reject(err);
      }

      // Primero, verifica si el trabajo cron existe
      pm2.describe(`cron-task-${feedId}`, (err, processDescription) => {
        if (err) {
          pm2.disconnect();
          return reject(err);
        }

        // Si el proceso existe, elimínalo
        if (processDescription && processDescription.length > 0) {
          pm2.delete(`cron-task-${feedId}`, (err) => {
            pm2.disconnect();
            if (err) {
              return reject(err);
            }
            resolve(`Trabajo cron eliminado exitosamente para feedId: ${feedId}`);
          });
        } else {
          // Si el proceso no existe, no hay nada que eliminar
          pm2.disconnect();
          resolve(`No se encontró ningún trabajo cron para feedId: ${feedId}`);
        }
      });
    });
  });
}


module.exports = {
  transformProduct,
  delay,
  fetchWithRetry,
  generateHash,
  encrypt,
  decrypt,
  logMemoryUsage,
  createCronJob,
  createSimpleCron,
  buildQueryUrl,
  doesCronJobExist,
  deleteCronJob
};
