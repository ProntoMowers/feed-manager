const express = require('express');
const app = express(); 
const path = require('path');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const handlebars = require('handlebars');
const methodOveride = require("method-override")
const session = require("express-session")
const flash = require('express-flash');
const passport = require('passport');

const database = require(path.join(__dirname, 'databases', 'prontoWebDB'));
const GoogleAPI = require(path.join(__dirname, 'api', 'googleMerchantAPI'));

require("./src/config/passport.js");

handlebars.registerHelper('ifCond', function (v1, v2, options) {
  if (v1 === v2) {
      return options.fn(this);
  }
  return options.inverse(this);
});

handlebars.registerHelper('eq', function (a, b) {
  if (a === undefined || b === undefined) {
      return false;
  }
  return a === b;
});

handlebars.registerHelper('includes', function(array, value) {
  if (!Array.isArray(array)) {
      return false;
  }
  return array.includes(value);
});


// Setting up Handlebars
app.set('views', path.join(__dirname,"src","views"));
app.engine('.hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main', 
  layoutsDir: path.join(app.get('views'), 'layouts'),
  partialsDir: path.join(app.get('views'), 'partials')
}));
app.set('view engine', '.hbs');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Important to be before route definitions
app.use(cookieParser());
app.use(methodOveride('_method'));
app.use(session({
    secret: 'mysecretapp',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Middleware para capturar errores no capturados
process.on('uncaughtException', function (err) {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', function (reason, p) {
    console.error('Unhandled Rejection:', reason);
});

// Global Variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  next();
});

// Static Files
app.use(express.static(path.join(__dirname,"src","public")));

// Importing routers
const routerCompanies = require("./routes/RoutesDBCRUD/companies");
const routerModules = require("./routes/RoutesDBCRUD/modules.js");
const routerFeeds = require("./routes/RoutesDBCRUD/feeds");
const routerRoles = require("./routes/RoutesDBCRUD/roles");
const routerUsers = require("./routes/RoutesDBCRUD/users");
const routerUserRoles = require("./routes/RoutesDBCRUD/userRoles.js");
const routerRoleModules = require("./routes/RoutesDBCRUD/roleModules.js");
const routerUserCompany = require("./routes/RoutesDBCRUD/userCompany.js");
const routerUserFeeds = require("./routes/RoutesDBCRUD/userFeed");
const routerAuth = require("./routes/auth.js");
const routerMerchant = require("./routes/Merchant/googleMerchant");
const routerImages = require("./routes/Merchant/images");
const routerOrders = require("./routes/Merchant/orders");
const routerProducts = require("./routes/Merchant/products");
const routerWebHooks = require("./routes/Merchant/webHooks");
const appRouter = require("./routes/index");

// Register routers
app.use(routerOrders);
app.use(routerUserRoles);
app.use(routerProducts);
app.use(routerRoleModules);
app.use(routerModules);
app.use(routerMerchant);
app.use(routerImages);
app.use(routerWebHooks);
app.use(routerAuth);
app.use(routerCompanies);
app.use(routerUserCompany);
app.use(routerFeeds);
app.use(routerRoles);
app.use(routerUsers);
app.use(routerUserFeeds);
app.use(routerAuth);
app.use(appRouter);


const {startCronJob} = require("./helpers/queue.js")
// Server is listening
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Prueba 11`);
  //startCronJob();

    /* Modificaste app, auth y queue */
});


